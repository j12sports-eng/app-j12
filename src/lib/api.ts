import { clearAuthSession, getStoredAuthToken } from "./auth-storage";
import { isServerRender, logSsr } from "./ssr-debug";

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

const DEFAULT_BROWSER_API_URL = "/api";
const DEFAULT_HML_BROWSER_API_URL = "/__api";
const DEFAULT_SERVER_API_URL = "http://127.0.0.1:3001";
const DEFAULT_API_TIMEOUT_MS = 12000;
const FRONTEND_SELF_HOSTS = new Set(["app.j12sports.com.br", "localhost", "127.0.0.1"]);
const FRONTEND_SELF_PORTS = new Set(["3000", "4173", "5173", "5174"]);
const HML_FRONTEND_HOSTS = new Set(["hml.app.j12sports.com.br"]);

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function normalizeEndpoint(endpoint: string): string {
  const trimmedEndpoint = endpoint.trim();

  if (isAbsoluteHttpUrl(trimmedEndpoint)) {
    return trimmedEndpoint;
  }

  return trimmedEndpoint.startsWith("/") ? trimmedEndpoint : `/${trimmedEndpoint}`;
}

function joinApiUrl(baseUrl: string, endpoint: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  if (
    (normalizedBaseUrl.endsWith("/api") || normalizedBaseUrl.endsWith("/__api")) &&
    endpoint.startsWith("/api")
  ) {
    return `${baseUrl}${endpoint.slice(4)}`;
  }

  return `${baseUrl}${endpoint}`;
}

function normalizeBaseUrl(value: unknown, fallback: string): string {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\/+$/, "");

  return normalized || fallback;
}

function stripKnownAuthPath(value: string): string {
  return value
    .replace(/\/__api\/auth\/login$/i, "/__api")
    .replace(/\/api\/auth\/login$/i, "/api")
    .replace(/\/auth\/login$/i, "")
    .replace(/\/__api\/auth$/i, "/__api")
    .replace(/\/api\/auth$/i, "/api")
    .replace(/\/auth$/i, "");
}

function isHmlBrowserHost(): boolean {
  return isBrowser() && HML_FRONTEND_HOSTS.has(window.location.hostname.toLowerCase());
}

function getDefaultBrowserApiUrl(): string {
  return isHmlBrowserHost() ? DEFAULT_HML_BROWSER_API_URL : DEFAULT_BROWSER_API_URL;
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getApiTimeoutMs() {
  const processEnv =
    typeof process !== "undefined" && process.env ? process.env.SSR_API_TIMEOUT_MS : "";

  return parsePositiveInteger(
    processEnv || import.meta.env.VITE_API_TIMEOUT_MS,
    DEFAULT_API_TIMEOUT_MS,
  );
}

function isFrontendSelfUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const port = url.port || (url.protocol === "https:" ? "443" : "80");

    if (hostname === "app.j12sports.com.br") {
      return true;
    }

    return FRONTEND_SELF_HOSTS.has(hostname) && FRONTEND_SELF_PORTS.has(port);
  } catch {
    return false;
  }
}

function resolveServerApiBaseUrl(configuredValue: unknown): string {
  const normalized = stripKnownAuthPath(normalizeBaseUrl(configuredValue, DEFAULT_SERVER_API_URL));

  if (!isAbsoluteHttpUrl(normalized)) {
    logSsr("[SSR] API base relativa detectada; usando backend local", {
      configured: normalized,
      fallback: DEFAULT_SERVER_API_URL,
    });

    return DEFAULT_SERVER_API_URL;
  }

  if (!isFrontendSelfUrl(normalized)) {
    return normalized;
  }

  logSsr("[SSR] API base apontava para o proprio frontend; usando backend local", {
    configured: normalized,
    fallback: DEFAULT_SERVER_API_URL,
  });

  return DEFAULT_SERVER_API_URL;
}

function getServerApiBaseUrl(): string {
  const processEnv =
    typeof process !== "undefined" && process.env
      ? process.env.SSR_API_URL ||
        process.env.API_BASE_URL ||
        process.env.AUTH_URL ||
        process.env.API_TARGET ||
        process.env.VITE_API_URL
      : "";

  return resolveServerApiBaseUrl(
    processEnv ||
      import.meta.env.VITE_API_URL ||
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_AUTH_URL,
  );
}

function getBrowserApiBaseUrl(): string {
  const configuredBaseUrl = stripKnownAuthPath(
    normalizeBaseUrl(
      import.meta.env.VITE_API_URL ||
        import.meta.env.VITE_API_BASE_URL ||
        import.meta.env.VITE_AUTH_URL,
      getDefaultBrowserApiUrl(),
    ),
  );

  if (isHmlBrowserHost() && configuredBaseUrl === DEFAULT_BROWSER_API_URL) {
    return DEFAULT_HML_BROWSER_API_URL;
  }

  return configuredBaseUrl;
}

function getSafeStoredAuthToken(): string | null {
  return isBrowser() ? getStoredAuthToken() : null;
}

function clearSafeAuthSession(): void {
  if (isBrowser()) {
    clearAuthSession();
  }
}

export function getApiBaseUrl(): string {
  return isBrowser() ? getBrowserApiBaseUrl() : getServerApiBaseUrl();
}

export function buildApiUrl(endpoint: string): string {
  const normalizedEndpoint = normalizeEndpoint(endpoint);

  if (isAbsoluteHttpUrl(normalizedEndpoint)) {
    return normalizedEndpoint;
  }

  return joinApiUrl(getApiBaseUrl(), normalizedEndpoint);
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function isUrlSearchParams(value: unknown): value is URLSearchParams {
  return typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams;
}

function isReadableStream(value: unknown): value is ReadableStream {
  return typeof ReadableStream !== "undefined" && value instanceof ReadableStream;
}

function isArrayBufferBody(value: unknown): value is BodyInit {
  return (
    (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) ||
    (typeof ArrayBuffer !== "undefined" &&
      ArrayBuffer.isView(value) &&
      value.buffer instanceof ArrayBuffer)
  );
}

function buildHeaders(
  headers: HeadersInit | undefined,
  token: string | null,
  skipAuthHeader: boolean,
  body: BodyInit | null | undefined,
): Headers {
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
    isBlob(body) ||
    isUrlSearchParams(body) ||
    isReadableStream(body) ||
    isArrayBufferBody(body)
  ) {
    return body;
  }

  return JSON.stringify(body);
}

function hasApiData<T>(value: unknown): value is { data: T } {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    typeof (value as { data?: unknown }).data !== "undefined"
  );
}

export function extractApiData<T>(payload: T | ApiEnvelope<T>): T {
  if (hasApiData<T>(payload)) {
    return payload.data;
  }

  return payload as T;
}

async function parseResponseBody(response: Response): Promise<unknown> {
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

function createTimeoutSignal(timeoutMs: number, existingSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (existingSignal) {
    if (existingSignal.aborted) {
      controller.abort();
    } else {
      existingSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

function shouldRedirectOnUnauthorized(endpoint: string, options: ApiRequestInit): boolean {
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  const isAuthEndpoint =
    normalizedEndpoint.startsWith("/auth/") ||
    normalizedEndpoint.startsWith("/api/auth/") ||
    /^https?:\/\/[^/]+\/(?:api\/)?auth\//i.test(normalizedEndpoint);

  return isBrowser() && !options.skipAuthRedirect && !isAuthEndpoint;
}

export async function apiFetch<T>(endpoint: string, options: ApiRequestInit = {}): Promise<T> {
  const {
    body: rawBody,
    headers,
    skipAuthHeader = false,
    skipAuthRedirect = false,
    ...fetchOptions
  } = options;

  const token = getSafeStoredAuthToken();
  const url = buildApiUrl(endpoint);
  const body = serializeBody(rawBody);

  if (isServerRender() && isFrontendSelfUrl(url)) {
    throw new ApiError(`SSR bloqueou fetch para o proprio frontend: ${url}`, 500, { url });
  }

  const timeoutMs = getApiTimeoutMs();
  const startedAt = Date.now();
  const timeout = createTimeoutSignal(timeoutMs, fetchOptions.signal ?? undefined);

  logSsr("[SSR] apiFetch iniciou", {
    endpoint,
    url,
    method: fetchOptions.method || "GET",
    timeoutMs,
  });

  let response: Response;

  try {
    response = await fetch(url, {
      ...fetchOptions,
      signal: timeout.signal,
      body,
      headers: buildHeaders(headers, token, skipAuthHeader, body),
    });
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;

    logSsr("[SSR] apiFetch falhou", {
      endpoint,
      url,
      elapsedMs,
      error: error instanceof Error ? error.message : String(error),
    });

    if (timeout.signal.aborted) {
      throw new ApiError(`Timeout ao chamar API: ${url}`, 504, { url, timeoutMs });
    }

    throw error;
  } finally {
    timeout.cleanup();
  }

  const data = await parseResponseBody(response);

  logSsr("[SSR] apiFetch terminou", {
    endpoint,
    url,
    status: response.status,
    elapsedMs: Date.now() - startedAt,
  });

  if (response.status === 401) {
    clearSafeAuthSession();

    if (shouldRedirectOnUnauthorized(endpoint, { ...options, skipAuthRedirect })) {
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

async function request<T>(endpoint: string, options: ApiRequestInit = {}): Promise<T> {
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
