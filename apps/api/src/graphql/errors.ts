import { GraphQLError } from "graphql";

/**
 * An error a resolver raises on purpose. `status` is the HTTP-style status the API has always reported (404, 422,
 * 409...); clients read it from `extensions`. The transport's own status is 200 for these, as GraphQL expects, except
 * where `httpStatus` says the request itself was refused (not signed in, rate limited, cross-site).
 */
export class ApiGraphQLError extends GraphQLError {
  readonly httpStatus: number;

  constructor(status: number, code: string, message: string, { fields, httpStatus }: { fields?: Record<string, string>; httpStatus?: number } = {}) {
    super(message, { extensions: { code, status, ...(fields ? { fields } : {}) } });
    this.httpStatus = httpStatus ?? 200;
  }
}

export const unauthenticated = () => new ApiGraphQLError(401, "unauthenticated", "Sign in to continue", { httpStatus: 401 });
export const crossSite = () => new ApiGraphQLError(403, "forbidden", "Cross-site request refused", { httpStatus: 403 });
export const rateLimited = () => new ApiGraphQLError(429, "rate_limited", "Too many attempts. Try again later.", { httpStatus: 429 });
export const forbidden = (message = "You do not have permission to do that") => new ApiGraphQLError(403, "forbidden", message);
export const notFound = (what: string) => new ApiGraphQLError(404, "not_found", `${what} not found`);
export const badRequest = (message: string) => new ApiGraphQLError(400, "bad_request", message);
export const conflict = (code: string, message: string) => new ApiGraphQLError(409, code, message);
export const validationFailed = (fields: Record<string, string>) => new ApiGraphQLError(422, "validation_failed", "Some fields are invalid", { fields });
export const emailTaken = () => validationFailed({ email: "emailTaken" });
