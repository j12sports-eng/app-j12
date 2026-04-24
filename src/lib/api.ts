/**
 * Camada HTTP para a API principal atual do app (auth, settings e colecoes legadas).
 * Configure VITE_API_URL no .env para apontar para esse backend.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("j12_token");
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;

  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof TypeError) {
      const target = API_BASE_URL || "API configurada";
      throw new ApiError(
        0,
        `Nao foi possivel conectar a ${target}. Inicie o backend local e tente novamente.`,
      );
    }

    throw error;
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, (data && data.message) || res.statusText);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
