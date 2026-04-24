export const MYSQL_API_BASE_URL =
  import.meta.env.VITE_MYSQL_API_URL || "http://localhost:3001";

function getMysqlToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("j12_mysql_token");
}

export class MysqlApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getMysqlToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${MYSQL_API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new MysqlApiError(
        0,
        "Nao foi possivel conectar a API MySQL. Inicie o backend em http://localhost:3001.",
      );
    }

    throw error;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new MysqlApiError(response.status, data?.message || response.statusText);
  }

  return data as T;
}

export const mysqlApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
