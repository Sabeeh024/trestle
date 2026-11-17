import {
  buildSchema,
  execute,
  GraphQLError,
  Kind,
  NoSchemaIntrospectionCustomRule,
  parse,
  specifiedRules,
  validate,
  type DocumentNode,
  type FragmentDefinitionNode,
  type SelectionSetNode,
  type ValidationRule,
} from "graphql";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { authenticate, type Deps, type Principal } from "../context";
import { dashboard } from "./dashboard";
import { ApiGraphQLError } from "./errors";
import type { GqlContext } from "./context";
import { adminMutations, adminQueries } from "./resolvers/admin";
import { authMutations, authQueries } from "./resolvers/auth";
import { projectMutations, projectQueries } from "./resolvers/projects";
import { taskMutations, taskQueries } from "./resolvers/tasks";
import { typeDefs } from "./schema";

/** How many top-level fields one request may ask for, and how long its text may be. Generous for the apps, small for abuse. */
const MAX_ROOT_FIELDS = 12;
const MAX_QUERY_LENGTH = 20_000;

// Only the root fields have resolvers: they load whole objects with a fixed number of queries (hydrateProjects, the
// window-count lists), so nested fields are plain properties and a request's query count does not grow with its size.
const rootValue = {
  ...authQueries,
  ...projectQueries,
  ...taskQueries,
  ...adminQueries,
  dashboard,
  ...authMutations,
  ...projectMutations,
  ...taskMutations,
  ...adminMutations,
};

const schema = buildSchema(typeDefs);

/** Top-level fields of an operation, counting those pulled in through fragments. */
function rootFieldCount(set: SelectionSetNode, fragments: Map<string, FragmentDefinitionNode>, seen: ReadonlySet<string>): number {
  let count = 0;
  for (const selection of set.selections) {
    if (selection.kind === Kind.FIELD) count++;
    else if (selection.kind === Kind.INLINE_FRAGMENT) count += rootFieldCount(selection.selectionSet, fragments, seen);
    else {
      const name = selection.name.value;
      const fragment = fragments.get(name);
      if (fragment && !seen.has(name)) count += rootFieldCount(fragment.selectionSet, fragments, new Set([...seen, name]));
    }
  }
  return count;
}

// Every root field is a resolver that may hit the database, so one request cannot ask for an unbounded number of them.
const limitOperations: ValidationRule = (context) => {
  const document: DocumentNode = context.getDocument();
  const fragments = new Map(document.definitions.filter((d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION).map((f) => [f.name.value, f]));
  return {
    OperationDefinition(operation) {
      if (rootFieldCount(operation.selectionSet, fragments, new Set()) > MAX_ROOT_FIELDS) {
        context.reportError(new GraphQLError(`An operation may ask for at most ${MAX_ROOT_FIELDS} top-level fields`, { nodes: operation }));
      }
    },
  };
};

type ErrorBody = { message: string; path?: readonly (string | number)[]; extensions: { code: string; status: number; fields?: unknown } };

/** What a client sees of an error: deliberate ones as raised, malformed requests as 400s, anything else as a masked 500. */
function describe(error: GraphQLError): { body: ErrorBody; httpStatus: number } {
  const path = error.path ? { path: error.path } : {};
  const original = error.originalError;
  if (original instanceof ApiGraphQLError) {
    const { code, status, fields } = original.extensions as { code: string; status: number; fields?: unknown };
    return { body: { message: original.message, ...path, extensions: { code, status, ...(fields ? { fields } : {}) } }, httpStatus: original.httpStatus };
  }
  // No original error, or one that is itself GraphQL's: the request was refused before any resolver ran (syntax,
  // validation, bad variables), which is the client's mistake.
  if (!original || original instanceof GraphQLError) return { body: { message: error.message, ...path, extensions: { code: "bad_request", status: 400 } }, httpStatus: 400 };

  console.error(original);
  return { body: { message: "Something went wrong", ...path, extensions: { code: "internal_error", status: 500 } }, httpStatus: 500 };
}

const refuse = (c: Context, message: string, status = 400) =>
  c.json({ errors: [{ message, extensions: { code: "bad_request", status: 400 } }] }, status as ContentfulStatusCode);

/**
 * POST /api/graphql. One endpoint for every operation. Only a single JSON operation is accepted (no batching, and
 * `application/json` alone, which a cross-site form cannot send), so each request is one thing to authenticate,
 * rate-limit and audit.
 */
export function graphqlHandler(deps: Deps, { introspection }: { introspection: boolean }) {
  const rules = [...specifiedRules, limitOperations, ...(introspection ? [] : [NoSchemaIntrospectionCustomRule])];

  return async (c: Context) => {
    if (!c.req.header("content-type")?.toLowerCase().startsWith("application/json")) {
      return refuse(c, "Send the operation as application/json", 415);
    }
    const payload: unknown = await c.req.json().catch(() => undefined);
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return refuse(c, "The body must be one JSON object");
    const { query, variables, operationName } = payload as { query?: unknown; variables?: unknown; operationName?: unknown };
    if (typeof query !== "string" || query.length === 0 || query.length > MAX_QUERY_LENGTH) return refuse(c, "A query string is required");
    if (variables != null && (typeof variables !== "object" || Array.isArray(variables))) return refuse(c, "variables must be an object");
    if (operationName != null && typeof operationName !== "string") return refuse(c, "operationName must be a string");

    let document: DocumentNode;
    try {
      document = parse(query);
    } catch (error) {
      return c.json({ errors: [describe(error as GraphQLError).body] }, 400);
    }
    const invalid = validate(schema, document, rules);
    if (invalid.length > 0) return c.json({ errors: invalid.map((e) => describe(e).body) }, 400);

    let principal: Promise<Principal> | undefined;
    const contextValue: GqlContext = { deps, http: c, me: () => (principal ??= authenticate(c, deps)) };

    const result = await execute({
      schema,
      document,
      rootValue,
      contextValue,
      variableValues: (variables as Record<string, unknown> | null | undefined) ?? undefined,
      operationName: (operationName as string | null | undefined) ?? undefined,
    });
    if (!result.errors) return c.json({ data: result.data });

    const described = result.errors.map(describe);
    // Every root field is non-null, so an error leaves no data at all: say so in the status when the request itself
    // was refused (not signed in, rate limited, cross-site) so clients and proxies can tell without parsing.
    const status = result.data == null ? Math.max(...described.map((d) => d.httpStatus)) : 200;
    return c.json({ data: result.data ?? null, errors: described.map((d) => d.body) }, status as ContentfulStatusCode);
  };
}
