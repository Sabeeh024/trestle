export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string;
  /** Per-field messages from a validation failure (HTTP 422), keyed by field name. */
  readonly fields: Readonly<Record<string, string>> | undefined;

  constructor(message: string, code: string, status: number | null, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

interface ErrorDetail {
  code?: unknown;
  message?: unknown;
  fields?: unknown;
  status?: unknown;
}

/** The first error in a body, whether the API sent a GraphQL `{ errors: [{ extensions }] }` or a plain `{ error }` (proxies, size limits). */
function errorDetail(body: unknown): ErrorDetail | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const { errors, error } = body as { errors?: unknown; error?: ErrorDetail };
  const first = Array.isArray(errors) ? (errors[0] as { message?: unknown; extensions?: ErrorDetail } | undefined) : undefined;
  if (first) return { ...first.extensions, message: first.message };
  return error;
}

/**
 * Builds an ApiError from a failed response. A GraphQL error carries its own status in `extensions` (404, 422...), because
 * the HTTP status is 200 for those; when it is absent the HTTP status is used.
 */
export function apiErrorFromResponse(status: number, body: unknown): ApiError {
  const detail = errorDetail(body);
  const code = typeof detail?.code === "string" ? detail.code : "http_error";
  const message = typeof detail?.message === "string" ? detail.message : `Request failed with status ${status}`;
  const effective = typeof detail?.status === "number" ? detail.status : status;
  return new ApiError(message, code, effective, readFields(detail?.fields));
}

function readFields(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const fields = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return fields.length > 0 ? Object.fromEntries(fields) : undefined;
}

export const timeoutError = () => new ApiError("The request timed out", "timeout", null);
export const networkError = () => new ApiError("Could not reach the server", "network_error", null);
