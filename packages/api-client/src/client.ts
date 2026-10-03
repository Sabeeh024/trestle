import axios, { type AxiosInstance, type CreateAxiosDefaults } from "axios";

export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string;

  constructor(message: string, code: string, status: number | null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export interface ApiClientOptions {
  baseURL: string;
  /** Called before every request; return null to send it unauthenticated. */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Called after any 401 response, e.g. to clear the session and redirect to login. */
  onUnauthorized?: (error: ApiError) => void;
  timeoutMs?: number;
  axiosConfig?: CreateAxiosDefaults;
}

function toApiError(error: unknown): unknown {
  if (!axios.isAxiosError(error)) return error;
  if (axios.isCancel(error)) return error;

  const body: unknown = error.response?.data;
  const detail = typeof body === "object" && body !== null && "error" in body ? (body as { error?: { code?: unknown; message?: unknown } }).error : undefined;

  if (error.response) {
    const code = typeof detail?.code === "string" ? detail.code : "http_error";
    const message = typeof detail?.message === "string" ? detail.message : `Request failed with status ${error.response.status}`;
    return new ApiError(message, code, error.response.status);
  }
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return new ApiError("The request timed out", "timeout", null);
  return new ApiError("Could not reach the server", "network_error", null);
}

/** Creates an axios instance that sends the bearer token and rejects with {@link ApiError}. */
export function createApiClient({ baseURL, getToken, onUnauthorized, timeoutMs = 15_000, axiosConfig }: ApiClientOptions): AxiosInstance {
  const client = axios.create({ baseURL, timeout: timeoutMs, headers: { Accept: "application/json" }, ...axiosConfig });

  client.interceptors.request.use(async (config) => {
    const token = await getToken?.();
    if (token) config.headers.set("Authorization", `Bearer ${token}`);
    return config;
  });

  client.interceptors.response.use(undefined, (error: unknown) => {
    const normalized = toApiError(error);
    if (isApiError(normalized) && normalized.status === 401) onUnauthorized?.(normalized);
    return Promise.reject(normalized);
  });

  return client;
}
