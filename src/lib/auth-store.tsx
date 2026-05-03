import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, api } from "./api";
import {
  clearAuthSession,
  getStoredAuthToken,
  getStoredAuthUser,
  saveAuthSession,
} from "./auth-storage";

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

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, senha: string) => Promise<AuthUser>;
  logout: () => void;
  checkSession: () => Promise<AuthUser | null>;
  requestPasswordReset: (
    identifier: string,
    channel?: "email" | "whatsapp",
  ) => Promise<{ ok: true; message: string; previewUrl?: string | null }>;
  resetPassword: (token: string, senha: string, confirmarSenha: string) => Promise<void>;
  changePassword: (senhaAtual: string, novaSenha: string, confirmarSenha: string) => Promise<void>;
  completeFirstAccess: (payload: {
    numeroMatricula: string;
    dataNascimento: string;
    email: string;
    login?: string;
    senha: string;
    confirmarSenha: string;
  }) => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  isSelfService: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeFeatureError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.status === 404) {
    return new Error(fallback);
  }

  return error instanceof Error ? error : new Error(fallback);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async () => {
    const storedToken = getStoredAuthToken();
    const storedUser = getStoredAuthUser<AuthUser>();

    if (!storedToken) {
      setToken(null);
      setUser(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    setToken(storedToken);
    if (storedUser) {
      setUser(storedUser);
    }

    try {
      const freshUser = await api.get<AuthUser>("/auth/me");
      saveAuthSession(storedToken, freshUser);
      setUser(freshUser);
      setToken(storedToken);
      return freshUser;
    } catch {
      clearAuthSession();
      setUser(null);
      setToken(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const login = useCallback(async (email: string, senha: string) => {
    const data = await api.post<LoginResponse>(
      "/auth/login",
      {
        email,
        senha,
      },
      { skipAuthRedirect: true },
    );

    saveAuthSession(data.token, data.user);
    setUser(data.user);
    setToken(data.token);
    setLoading(false);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    const activeToken = getStoredAuthToken();

    void (async () => {
      try {
        if (activeToken) {
          await api.post("/auth/logout", {}, { skipAuthRedirect: true });
        }
      } catch {
        // Prioritize local cleanup even if the API logout fails.
      } finally {
        clearAuthSession({ redirectToLogin: true });
        setUser(null);
        setToken(null);
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      checkSession,
      requestPasswordReset: async (identifier, channel = "email") =>
        api.post<{ ok: true; message: string; previewUrl?: string | null }>(
          "/auth/forgot-password",
          { email: identifier, channel },
          { skipAuthRedirect: true },
        ),
      resetPassword: async (resetToken, senha, confirmarSenha) => {
        await api.post(
          "/auth/reset-password",
          {
            token: resetToken,
            senha,
            confirmarSenha,
          },
          { skipAuthRedirect: true },
        );
      },
      changePassword: async (senhaAtual, novaSenha, confirmarSenha) => {
        try {
          await api.post("/auth/change-password", {
            senhaAtual,
            novaSenha,
            confirmarSenha,
          });
        } catch (error) {
          throw normalizeFeatureError(
            error,
            "A troca de senha nao esta disponivel nesta API no momento.",
          );
        }
      },
      completeFirstAccess: async (payload) => {
        try {
          await api.post("/auth/first-access", payload, { skipAuthRedirect: true });
        } catch (error) {
          throw normalizeFeatureError(
            error,
            "O primeiro acesso nao esta disponivel nesta API no momento.",
          );
        }
      },
      hasRole: (...roles: Role[]) => Boolean(user && roles.includes(user.role)),
      isSelfService: user?.role === "aluno" || user?.role === "responsavel",
    }),
    [checkSession, loading, login, logout, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  }

  return context;
}
