import axios, { type AxiosInstance, type CreateAxiosDefaults } from "axios";

import { apiErrorFromResponse, isApiError, networkError, timeoutError } from "../errors";
import type { Transport, TransportOptions } from "../transport";

export interface AxiosTransportOptions extends TransportOptions {
  axiosConfig?: CreateAxiosDefaults;
  /**
   * Keep the session in an HttpOnly cookie the browser manages instead of a token the page holds: requests carry
   * credentials, and sign-in asks the API for a cookie. The API must allow this origin with credentials.
   */
  cookieSession?: boolean;
}

function toApiError(error: unknown): unknown {
  if (!axios.isAxiosError(error) || axios.isCancel(error)) return error;
  if (error.response) return apiErrorFromResponse(error.response.status, error.response.data);
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return timeoutError();
  return networkError();
}

/** The traditional web transport, for the Vite SPA and React Native. `client` is exposed for extra interceptors. */
export function createAxiosTransport({
  baseURL,
  getToken,
  onUnauthorized,
  timeoutMs = 15_000,
  axiosConfig,
  cookieSession = false,
}: AxiosTransportOptions): Transport & { client: AxiosInstance } {
  const client = axios.create({
    baseURL,
    timeout: timeoutMs,
    headers: { Accept: "application/json", ...(cookieSession ? { "X-Auth-Mode": "cookie" } : {}) },
    withCredentials: cookieSession,
    ...axiosConfig,
  });

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

  return {
    client,
    async request<T>({ method, url, params, body, signal }: Parameters<Transport["request"]>[0]) {
      const response = await client.request<T>({ method, url, params, data: body, signal });
      return response.data;
    },
  };
}
