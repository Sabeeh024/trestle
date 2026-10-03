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

/** Builds an ApiError from a failed response, reading the server's `{ error: { code, message } }` body when present. */
export function apiErrorFromResponse(status: number, body: unknown): ApiError {
  const detail =
    typeof body === "object" && body !== null && "error" in body
      ? (body as { error?: { code?: unknown; message?: unknown; fields?: unknown } }).error
      : undefined;
  const code = typeof detail?.code === "string" ? detail.code : "http_error";
  const message = typeof detail?.message === "string" ? detail.message : `Request failed with status ${status}`;
  return new ApiError(message, code, status, readFields(detail?.fields));
}

function readFields(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const fields = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return fields.length > 0 ? Object.fromEntries(fields) : undefined;
}

export const timeoutError = () => new ApiError("The request timed out", "timeout", null);
export const networkError = () => new ApiError("Could not reach the server", "network_error", null);
