import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserPlus,
  UserRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import loginHeroImage from "@/assets/login-j12-jessiquinha.png";
import { Skeleton, SkeletonForm } from "@/components/ui/skeleton";
import { getRoleHomePath, useAuth } from "@/lib/auth";
import { logSsr, logSsrRoute } from "@/lib/ssr-debug";

const REMEMBER_LOGIN_KEY = "j12:login:remember";
const REMEMBER_EMAIL_KEY = "j12:login:email";

type FeatureCard = {
  label: string;
  to: string;
  icon: LucideIcon;
};

const featureCards: FeatureCard[] = [
  {
    label: "Perfil",
    to: "/perfil",
    icon: UserRound,
  },
  {
    label: "Presença",
    to: "/presenca",
    icon: ClipboardList,
  },
  {
    label: "Financeiro",
    to: "/financeiro",
    icon: WalletCards,
  },
  {
    label: "Agenda",
    to: "/agenda",
    icon: CalendarDays,
  },
];

export const Route = createFileRoute("/login")({
  loader: () => {
    logSsr("[SSR] iniciou loader /login");
    logSsr("[SSR] terminou loader /login");
    return null;
  },
  component: LoginPage,
});

function LoginPage() {
  logSsrRoute("/login", "entrou na");

  const { login, loading } = useAuth();

  logSsr("[SSR] estado auth na rota /login", {
    loading,
  });

  const navigate = useNavigate();

  const [email, setEmail] = useState("");

  const [senha, setSenha] = useState("");

  const [rememberLogin, setRememberLogin] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [errors, setErrors] = useState<{
    email?: string;
    senha?: string;
  }>({});

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const shouldRemember = window.localStorage.getItem(REMEMBER_LOGIN_KEY) === "true";
    setRememberLogin(shouldRemember);

    if (shouldRemember) {
      setEmail(window.localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "");
    }
  }, []);

  function validate() {
    const nextErrors: typeof errors = {};

    if (!email.trim()) {
      nextErrors.email = "Informe seu e-mail.";
    }

    if (!senha.trim()) {
      nextErrors.senha = "Informe sua senha.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  function persistRememberedLogin() {
    if (typeof window === "undefined") {
      return;
    }

    if (rememberLogin) {
      window.localStorage.setItem(REMEMBER_LOGIN_KEY, "true");
      window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      return;
    }

    window.localStorage.removeItem(REMEMBER_LOGIN_KEY);
    window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const session = await login(email.trim(), senha);

      persistRememberedLogin();

      toast.success("Bem-vindo de volta.");

      navigate({
        to: getRoleHomePath(session.user),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao entrar");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFeatureNavigation(destination: string) {
    navigate({ to: destination });
  }

  if (loading && !submitting) {
    return <LoginSkeleton />;
  }

  return (
    <main className="j12-login-page">
      <div className="j12-login-shell">
        <section className="j12-login-hero" aria-labelledby="login-hero-title">
          <img
            src={loginHeroImage}
            alt="Jessiquinha bicampeã mundial ao lado do escudo J12 e do texto App J12"
            className="j12-login-hero-image"
          />
          <div className="sr-only">
            <h1 id="login-hero-title">JESSIQUINHA</h1>
            <p>BICAMPEÃ MUNDIAL</p>
            <p>App J12</p>
          </div>
        </section>

        <section className="j12-login-content">
          <nav aria-label="Atalhos do App J12">
            <div className="j12-login-shortcuts">
              {featureCards.map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => handleFeatureNavigation(card.to)}
                  className="j12-login-shortcut"
                  aria-label={`Abrir ${card.label}`}
                >
                  <card.icon
                    className="j12-login-shortcut-icon"
                    strokeWidth={card.label === "Financeiro" ? 2.4 : 2.8}
                    aria-hidden="true"
                  />
                  <span className="j12-login-shortcut-label">{card.label}</span>
                </button>
              ))}
            </div>
          </nav>

          <form onSubmit={handleSubmit} className="j12-login-form" aria-label="Login J12">
            <div>
              <label htmlFor="login-email" className="sr-only">
                E-mail
              </label>
              <div className={`j12-login-field ${errors.email ? "j12-login-field-error" : ""}`}>
                <Mail className="j12-login-field-icon" aria-hidden />
                <input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="E-mail"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);

                    if (errors.email) {
                      setErrors((current) => ({
                        ...current,
                        email: undefined,
                      }));
                    }
                  }}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "login-email-error" : undefined}
                  className="j12-login-input"
                />
              </div>
              {errors.email ? (
                <p id="login-email-error" className="j12-login-error">
                  {errors.email}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="login-password" className="sr-only">
                Senha
              </label>
              <div className={`j12-login-field ${errors.senha ? "j12-login-field-error" : ""}`}>
                <LockKeyhole className="j12-login-field-icon" aria-hidden />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Senha"
                  value={senha}
                  onChange={(event) => {
                    setSenha(event.target.value);

                    if (errors.senha) {
                      setErrors((current) => ({
                        ...current,
                        senha: undefined,
                      }));
                    }
                  }}
                  aria-invalid={Boolean(errors.senha)}
                  aria-describedby={errors.senha ? "login-password-error" : undefined}
                  className="j12-login-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="j12-login-eye"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="j12-login-eye-icon" />
                  ) : (
                    <Eye className="j12-login-eye-icon" />
                  )}
                </button>
              </div>
              {errors.senha ? (
                <p id="login-password-error" className="j12-login-error">
                  {errors.senha}
                </p>
              ) : null}
            </div>

            <div className="j12-login-actions">
              <label className="j12-login-remember">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(event) => setRememberLogin(event.target.checked)}
                  className="j12-login-checkbox"
                  aria-label="Lembrar meus dados"
                />
                <span>Lembrar meus dados</span>
              </label>

              <Link to="/forgot-password" className="j12-login-link">
                Esqueci minha senha
              </Link>
            </div>

            <button type="submit" disabled={submitting || loading} className="j12-login-submit">
              {submitting ? (
                "Entrando..."
              ) : (
                <>
                  Entrar
                  <ArrowRight className="j12-login-submit-icon" aria-hidden />
                </>
              )}
            </button>

            <div className="j12-login-divider">
              <span className="j12-login-divider-line" />
              <span>ou</span>
              <span className="j12-login-divider-line" />
            </div>

            <Link to="/primeiro-acesso" className="j12-login-first-access">
              <UserPlus className="j12-login-first-access-icon" aria-hidden />
              Primeiro acesso
            </Link>

            <p className="j12-login-signup">
              Ainda não é aluno?{" "}
              <Link to="/matricula" className="j12-login-link">
                Matricule-se
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

function LoginSkeleton() {
  return (
    <main className="j12-login-page">
      <div className="j12-login-shell" role="status" aria-busy="true">
        <section className="j12-login-hero p-4 md:p-8" aria-label="Carregando imagem do login">
          <Skeleton className="aspect-[4/5] w-full max-w-[34rem] rounded-3xl md:aspect-[5/4] lg:aspect-[4/5]" />
        </section>

        <section className="j12-login-content">
          <div className="j12-login-shortcuts">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="j12-login-shortcut border-white/10" />
            ))}
          </div>

          <SkeletonForm fields={2} className="border-0 bg-transparent p-0 shadow-none" />

          <div className="space-y-4">
            <Skeleton className="h-16 rounded-2xl md:h-20" />
            <Skeleton className="h-14 rounded-2xl md:h-16" />
          </div>
        </section>
        <span className="sr-only">Carregando login J12</span>
      </div>
    </main>
  );
}
