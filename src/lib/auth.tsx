import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, API_BASE_URL } from "./api";
import { mysqlApi, MYSQL_API_BASE_URL } from "./mysql-api";

export type Role = "admin" | "coordenador" | "professor" | "aluno" | "responsavel";

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  login?: string;
  role: Role;
  teacherId?: string | null;
  studentId?: string | null;
  responsavelId?: string | null;
  classScope?: string[];
  status?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, senha: string) => Promise<AuthUser>;
  requestPasswordReset: (
    identifier: string,
    channel?: "email" | "whatsapp",
  ) => Promise<{ ok: true; message: string; previewUrl?: string | null }>;
  resetPassword: (token: string, senha: string, confirmarSenha: string) => Promise<void>;
  changePassword: (
    senhaAtual: string,
    novaSenha: string,
    confirmarSenha: string,
  ) => Promise<void>;
  completeFirstAccess: (payload: {
    numeroMatricula: string;
    dataNascimento: string;
    email: string;
    login?: string;
    senha: string;
    confirmarSenha: string;
  }) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
  isSelfService: boolean;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_USER = "j12_user";
const STORAGE_LEGACY_TOKEN = "j12_token";
const STORAGE_MYSQL_TOKEN = "j12_mysql_token";

function requiresLegacySession(role: Role) {
  return role === "admin" || role === "coordenador" || role === "professor";
}

function notifySessionReady() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("j12:session-ready"));
}

function notifySessionCleared() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("j12:session-cleared"));
}

function clearStoredSession() {
  localStorage.removeItem(STORAGE_USER);
  localStorage.removeItem(STORAGE_LEGACY_TOKEN);
  localStorage.removeItem(STORAGE_MYSQL_TOKEN);
}

async function revokeSession(baseUrl: string, token: string) {
  await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [legacyToken, setLegacyToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const storedUser = localStorage.getItem(STORAGE_USER);
        const storedMysqlToken = localStorage.getItem(STORAGE_MYSQL_TOKEN);
        const storedLegacyToken = localStorage.getItem(STORAGE_LEGACY_TOKEN);

        if (!storedMysqlToken) {
          if (active) setLoading(false);
          return;
        }

        setToken(storedMysqlToken);
        setLegacyToken(storedLegacyToken);

        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        const freshUser = await mysqlApi.get<AuthUser>("/auth/me");

        if (requiresLegacySession(freshUser.role)) {
          if (!storedLegacyToken) {
            throw new Error("Sessao administrativa incompleta.");
          }

          await api.get<AuthUser>("/auth/me");
        }

        if (!active) return;

        localStorage.setItem(STORAGE_USER, JSON.stringify(freshUser));
        setUser(freshUser);
        notifySessionReady();
      } catch {
        clearStoredSession();
        if (!active) return;
        setUser(null);
        setToken(null);
        setLegacyToken(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      login: async (identifier, senha) => {
        const data = await mysqlApi.post<LoginResponse>("/auth/login", {
          identifier,
          email: identifier,
          login: identifier,
          senha,
        });

        let nextLegacyToken: string | null = null;

        if (requiresLegacySession(data.user.role)) {
          const legacy = await api.post<LoginResponse>("/auth/login", {
            email: identifier,
            senha,
          });
          nextLegacyToken = legacy.token;
          localStorage.setItem(STORAGE_LEGACY_TOKEN, legacy.token);
          setLegacyToken(legacy.token);
        } else {
          try {
            const legacy = await api.post<LoginResponse>("/auth/login", {
              email: identifier,
              senha,
            });
            nextLegacyToken = legacy.token;
            localStorage.setItem(STORAGE_LEGACY_TOKEN, legacy.token);
            setLegacyToken(legacy.token);
          } catch {
            localStorage.removeItem(STORAGE_LEGACY_TOKEN);
            setLegacyToken(null);
          }
        }

        localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
        localStorage.setItem(STORAGE_MYSQL_TOKEN, data.token);
        setUser(data.user);
        setToken(data.token);
        if (!nextLegacyToken) {
          localStorage.removeItem(STORAGE_LEGACY_TOKEN);
          setLegacyToken(null);
        }
        notifySessionReady();
        return data.user;
      },
      requestPasswordReset: async (identifier, channel = "email") => {
        return mysqlApi.post<{ ok: true; message: string; previewUrl?: string | null }>(
          "/auth/forgot-password",
          { identifier, email: identifier, channel },
        );
      },
      resetPassword: async (resetToken, senha, confirmarSenha) => {
        await mysqlApi.post("/auth/reset-password", {
          token: resetToken,
          senha,
          confirmarSenha,
        });
      },
      changePassword: async (senhaAtual, novaSenha, confirmarSenha) => {
        await mysqlApi.post("/auth/change-password", {
          senhaAtual,
          novaSenha,
          confirmarSenha,
        });
      },
      completeFirstAccess: async (payload) => {
        await mysqlApi.post("/auth/first-access", payload);
      },
      logout: () => {
        const activeToken = token;
        const activeLegacyToken = legacyToken;

        if (activeToken) {
          void revokeSession(MYSQL_API_BASE_URL, activeToken).catch(() => {
            // Ignore logout network failures and prioritize local session cleanup.
          });
        }

        if (activeLegacyToken) {
          void revokeSession(API_BASE_URL, activeLegacyToken).catch(() => {
            // Ignore logout network failures and prioritize local session cleanup.
          });
        }

        clearStoredSession();
        setUser(null);
        setToken(null);
        setLegacyToken(null);
        notifySessionCleared();
      },
      hasRole: (...roles: Role[]) => !!user && roles.includes(user.role),
      isSelfService: user?.role === "aluno" || user?.role === "responsavel",
    }),
    [user, token, legacyToken, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
