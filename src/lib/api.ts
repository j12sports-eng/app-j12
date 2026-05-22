import { clearAuthSession, getStoredAuthToken } from "./auth-storage";


type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
};

type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuthHeader?: boolean;
  skipAuthRedirect?: boolean;
};

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status = 500, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const DEFAULT_DEV_API_URL = "http://127.0.0.1:3001";

function normalizeApiBaseUrl(value: unknown) {
  const configured = String(value ?? "")
    .trim()
    .replace(/\/+$/, "");

  if (!configured || configured === "/" || configured === ".") {
    return import.meta.env.DEV ? DEFAULT_DEV_API_URL : "/api";
  }

  return configured;
}

const API_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

export function getApiBaseUrl() {
  return API_URL;
}

export function buildApiUrl(endpoint: string) {
  const normalizedEndpoint = endpoint.trim().startsWith("/")
    ? endpoint.trim()
    : `/${endpoint.trim()}`;

  if (/^https?:\/\//i.test(normalizedEndpoint)) {
    return normalizedEndpoint;
  }

  if (API_URL === "/api" && normalizedEndpoint.startsWith("/api/")) {
    return normalizedEndpoint;
  }

  return `${API_URL}${normalizedEndpoint}`;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function isFormData(value: unknown): value is FormData {
  return isBrowser() && value instanceof FormData;
}

function buildHeaders(
  headers: HeadersInit | undefined,
  token: string | null,
  skipAuthHeader: boolean,
  body: BodyInit | null | undefined,
) {
  const normalized = new Headers(headers);

  if (!isFormData(body) && !normalized.has("Content-Type")) {
    normalized.set("Content-Type", "application/json");
  }

  if (!skipAuthHeader && token) {
    normalized.set("Authorization", `Bearer ${token}`);
  }

  return normalized;
}

function serializeBody(body: unknown): BodyInit | undefined {
  if (typeof body === "undefined" || body === null) {
    return undefined;
  }

  if (
    typeof body === "string" ||
    isFormData(body) ||
    body instanceof Blob ||
    body instanceof URLSearchParams
  ) {
    return body;
  }

  return JSON.stringify(body);
}

function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return typeof value === "object" && value !== null;
}

export function extractApiData<T>(payload: T | ApiEnvelope<T>): T {
  if (isApiEnvelope<T>(payload) && "data" in payload && typeof payload.data !== "undefined") {
    return payload.data as T;
  }

  return payload as T;
}

async function parseResponseBody(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const raw = await response.text();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function shouldRedirectOnUnauthorized(endpoint: string, options: ApiRequestInit) {
  const normalizedEndpoint = endpoint.trim().startsWith("/")
    ? endpoint.trim()
    : `/${endpoint.trim()}`;
  const isAuthEndpoint =
    normalizedEndpoint.startsWith("/auth/") ||
    normalizedEndpoint.startsWith("/api/auth/") ||
    /^https?:\/\/[^/]+\/(?:api\/)?auth\//i.test(normalizedEndpoint);

  return isBrowser() && !options.skipAuthRedirect && !isAuthEndpoint;
}

export async function apiFetch<T>(endpoint: string, options: ApiRequestInit = {}): Promise<T> {
  const token = getStoredAuthToken();
  const url = buildApiUrl(endpoint);
  const body = serializeBody(options.body);

  const response = await fetch(url, {
    ...options,
    body,
    headers: buildHeaders(options.headers, token, Boolean(options.skipAuthHeader), body),
  });

  const data = await parseResponseBody(response);

  if (response.status === 401) {
    clearAuthSession();

    if (shouldRedirectOnUnauthorized(endpoint, options)) {
      window.location.assign("/login");
    }
  }

  if (!response.ok) {
    throw new ApiError(
      (data as ApiEnvelope<unknown>)?.error ||
        (data as ApiEnvelope<unknown>)?.message ||
        "Erro na API",
      response.status,
      data,
    );
  }

  return data as T;
}

async function request<T>(endpoint: string, options: ApiRequestInit = {}) {
  const payload = await apiFetch<T | ApiEnvelope<T>>(endpoint, options);

  return extractApiData(payload);
}

export const api = {
  get<T = unknown>(endpoint: string, options?: Omit<ApiRequestInit, "method">) {
    return request<T>(endpoint, {
      ...options,
      method: "GET",
    });
  },

  post<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: Omit<ApiRequestInit, "method" | "body">,
  ) {
    return request<T>(endpoint, {
      ...options,
      method: "POST",
      body,
    });
  },

  put<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: Omit<ApiRequestInit, "method" | "body">,
  ) {
    return request<T>(endpoint, {
      ...options,
      method: "PUT",
      body,
    });
  },

  patch<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: Omit<ApiRequestInit, "method" | "body">,
  ) {
    return request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body,
    });
  },

  del<T = unknown>(endpoint: string, options?: Omit<ApiRequestInit, "method">) {
    return request<T>(endpoint, {
      ...options,
      method: "DELETE",
    });
  },

  delete<T = unknown>(endpoint: string, options?: Omit<ApiRequestInit, "method">) {
    return request<T>(endpoint, {
      ...options,
      method: "DELETE",
    });
  },
};

export function formatApiErrorMessage(error: unknown, fallback = "Erro interno da API"): string {
  if (error instanceof ApiError) {
    const payload = error.data as ApiEnvelope<unknown> | null;

    return payload?.error || payload?.message || error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}
