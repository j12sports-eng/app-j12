import { clearAuthSession, getStoredAuthToken } from "./auth-storage";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:3001";

function resolveApiBaseUrl(value: unknown) {
  if (typeof value !== "string") {
    return DEFAULT_API_BASE_URL;
  }

  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) {
    return DEFAULT_API_BASE_URL;
  }

  try {
    return new URL(normalized).toString().replace(/\/+$/, "");
  } catch {
    console.warn(`VITE_API_URL invalido (${normalized}). Usando fallback ${DEFAULT_API_BASE_URL}.`);
    return DEFAULT_API_BASE_URL;
  }
}

export const API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_URL || "http://127.0.0.1:3001",
);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type ApiFetchOptions = RequestInit & {
  skipAuthRedirect?: boolean;
};

export function formatApiErrorMessage(
  error: unknown,
  fallback = "Nao foi possivel concluir a solicitacao na API.",
) {
  if (error instanceof ApiError) {
    if (error.status === 0) return error.message || fallback;
    if (error.status === 401) {
      return "Sua sessao expirou. Faca login novamente para continuar.";
    }
    if (error.status === 403) {
      return error.message || "Voce nao tem permissao para acessar este recurso.";
    }
    if (error.status === 404) {
      return error.message || "Os dados solicitados nao foram encontrados na API.";
    }
    if (error.status >= 500) {
      return "A API encontrou um problema interno. Tente novamente em instantes.";
    }
    return error.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { skipAuthRedirect = false, ...init } = options;
  const token = getStoredAuthToken();
  const headers = new Headers(init.headers);

  if (init.body != null && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;

  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof TypeError) {
      const target = API_BASE_URL || "API configurada";
      throw new ApiError(
        0,
        `Nao foi possivel conectar a ${target}. Verifique se a API esta ativa e tente novamente em instantes.`,
      );
    }

    throw error;
  }

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (res.status === 401) {
    if (!skipAuthRedirect) {
      clearAuthSession({ redirectToLogin: true });
    }

    throw new ApiError(
      401,
      (data && data.message) || "Sua sessao expirou. Faca login novamente para continuar.",
    );
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data && data.message) ||
        formatApiErrorMessage(new ApiError(res.status, res.statusText), res.statusText),
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown, options: Omit<ApiFetchOptions, "body" | "method"> = {}) =>
    apiFetch<T>(path, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: <T>(path: string, body: unknown, options: Omit<ApiFetchOptions, "body" | "method"> = {}) =>
    apiFetch<T>(path, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  del: <T>(path: string, options: Omit<ApiFetchOptions, "method"> = {}) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
