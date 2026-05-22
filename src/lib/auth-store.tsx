import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiFetch } from "@/lib/api";

import { clearAuthSession, getAuthSession, saveAuthSession } from "@/lib/auth-storage";

export type Role = "admin" | "coordenador" | "professor" | "aluno" | "responsavel";

export type AuthUser = {
  id: string;
  nome: string;
  email: string;
  login?: string;
  role: Role;
  perfil: Role;
  aluno_id?: string | null;
  alunoId?: string | null;
  studentId?: string | null;
  professor_id?: string | null;
  teacherId?: string | null;
  responsavel_id?: string | null;
  responsavelId?: string | null;
  status?: string;
  source?: string;
};

type LoginResponse = {
  token: string;
  user: AuthUser;
};

type PasswordResetPreview = {
  ok?: boolean;
  message?: string;
  previewUrl?: string;
  expiresAt?: string;
  channel?: string;
};

type FirstAccessPayload = {
  numeroMatricula: string;
  dataNascimento: string;
  email: string;
  login?: string;
  senha: string;
  confirmarSenha: string;
};

export type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  role: Role | null;
  homePath: string;
  loading: boolean;
  isAuthenticated: boolean;
  isSelfService: boolean;
  hasRole: (...roles: Role[]) => boolean;
  login: (email: string, senha: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<PasswordResetPreview>;
  resetPassword: (token: string, senha: string, confirmarSenha: string) => Promise<void>;
  changePassword: (senhaAtual: string, novaSenha: string, confirmarSenha: string) => Promise<void>;
  completeFirstAccess: (payload: FirstAccessPayload) => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeRole(value: unknown): Role {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "admin") {
    return "admin";
  }

  if (normalized === "coordenador") {
    return "coordenador";
  }

  if (normalized === "professor") {
    return "professor";
  }

  if (normalized === "responsavel") {
    return "responsavel";
  }

  return "aluno";
}

function normalizeId(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeUser(user: Partial<AuthUser> | null | undefined): AuthUser | null {
  if (!user) {
    return null;
  }

  const role = normalizeRole(user.role ?? user.perfil);

  const nome = String(user.nome ?? user.login ?? user.email ?? "").trim() || "Usuario";

  const email = String(user.email ?? user.login ?? "").trim();

  return {
    id: normalizeId(user.id) || "0",
    nome,
    email,
    login: String(user.login ?? email).trim(),
    role,
    perfil: role,
    aluno_id:
      normalizeId(user.aluno_id) ?? normalizeId(user.alunoId) ?? normalizeId(user.studentId),
    alunoId: normalizeId(user.alunoId) ?? normalizeId(user.aluno_id) ?? normalizeId(user.studentId),
    studentId:
      normalizeId(user.studentId) ?? normalizeId(user.alunoId) ?? normalizeId(user.aluno_id),
    professor_id: normalizeId(user.professor_id) ?? normalizeId(user.teacherId),
    teacherId: normalizeId(user.teacherId) ?? normalizeId(user.professor_id),
    responsavel_id: normalizeId(user.responsavel_id) ?? normalizeId(user.responsavelId),
    responsavelId: normalizeId(user.responsavelId) ?? normalizeId(user.responsavel_id),
    status: user.status,
    source: user.source,
  };
}

function decodeTokenPayload(token: string) {
  try {
    const [, payload] = token.split(".");

    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");

    const decoded = atob(normalized);
    return JSON.parse(decoded) as {
      exp?: number;
    };
  } catch {
    return null;
  }
}

function isTokenExpired(token: string) {
  const payload = decodeTokenPayload(token);

  if (!payload?.exp) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);

  return payload.exp <= now;
}

export function getRoleHomePath(user: AuthUser | null | undefined) {
  const role = normalizeRole(user?.role ?? user?.perfil);

  switch (role) {
    case "admin":
    case "coordenador":
      return "/dashboard";
    case "professor":
      return "/professor/presencas";
    case "responsavel":
      return "/portal-responsavel/dashboard";
    case "aluno":
    default:
      return "/portal-aluno/dashboard";
  }
}

async function authRequest<T>(endpoint: string, body?: unknown, method = "POST") {
  return apiFetch<T>(endpoint, {
    method,
    body,
    skipAuthHeader: true,
    skipAuthRedirect: true,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const [token, setToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const session = getAuthSession();

    if (!session.token) {
      clearAuthSession();
      setToken(null);
      setUser(null);
      return;
    }

    if (isTokenExpired(session.token)) {
      clearAuthSession();
      setToken(null);
      setUser(null);
      return;
    }

    setToken(session.token);

    if (session.user) {
      setUser(normalizeUser(session.user));
    }

    try {
      const me = await apiFetch<Partial<AuthUser>>("/auth/me", {
        method: "GET",
        skipAuthRedirect: true,
      });

      const nextUser = normalizeUser(me);

      if (!nextUser) {
        throw new Error("Sessao invalida.");
      }

      saveAuthSession(session.token, nextUser);

      setUser(nextUser);
    } catch {
      clearAuthSession();
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refreshSession();
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshSession]);

  const login = useCallback(async (email: string, senha: string) => {
    const response = await authRequest<LoginResponse>("/auth/login", {
      email,
      login: email,
      password: senha,
      senha,
    });

    const nextUser = normalizeUser(response.user);

    if (!response.token || !nextUser) {
      throw new Error("Resposta de login invalida.");
    }

    saveAuthSession(response.token, nextUser);

    setToken(response.token);
    setUser(nextUser);

    return {
      token: response.token,
      user: nextUser,
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await apiFetch("/auth/logout", {
          method: "POST",
          skipAuthRedirect: true,
        });
      }
    } catch {
      // Ignore API logout failures and clear the local session anyway.
    } finally {
      clearAuthSession();
      setToken(null);
      setUser(null);

      if (typeof window !== "undefined") {
        window.location.assign("/login");
      }
    }
  }, [token]);

  const requestPasswordReset = useCallback(async (email: string) => {
    return authRequest<PasswordResetPreview>("/auth/forgot-password", {
      email,
    });
  }, []);

  const resetPassword = useCallback(
    async (resetToken: string, senha: string, confirmarSenha: string) => {
      await authRequest("/auth/reset-password", {
        token: resetToken,
        senha,
        confirmarSenha,
      });
    },
    [],
  );

  const changePassword = useCallback(
    async (senhaAtual: string, novaSenha: string, confirmarSenha: string) => {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: {
          senhaAtual,
          novaSenha,
          confirmarSenha,
        },
        skipAuthRedirect: true,
      });
    },
    [],
  );

  const completeFirstAccess = useCallback(async (payload: FirstAccessPayload) => {
    await authRequest("/auth/first-access", payload);
  }, []);

  const role = user?.role ?? user?.perfil ?? null;

  const hasRole = useCallback(
    (...roles: Role[]) => {
      if (!role) {
        return false;
      }

      return roles.includes(role);
    },
    [role],
  );

  const isSelfService = hasRole("aluno", "responsavel");

  const homePath = getRoleHomePath(user);

  const value = useMemo(
    () => ({
      user,
      token,
      role,
      homePath,
      loading,
      isAuthenticated: Boolean(token && user),
      isSelfService,
      hasRole,
      login,
      logout,
      requestPasswordReset,
      resetPassword,
      changePassword,
      completeFirstAccess,
      refreshSession,
    }),
    [
      user,
      token,
      role,
      homePath,
      loading,
      isSelfService,
      hasRole,
      login,
      logout,
      requestPasswordReset,
      resetPassword,
      changePassword,
      completeFirstAccess,
      refreshSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth precisa estar dentro do AuthProvider");
  }

  return context;
}
