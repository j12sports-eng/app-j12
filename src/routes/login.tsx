import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  UserPlus,
  UserRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import loginHeroImage from "@/assets/login-j12-jessiquinha.png";
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

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto min-h-screen w-full max-w-[853px] overflow-hidden bg-[#030303] shadow-[0_0_80px_rgba(255,102,0,0.18)]">
        <section
          className="relative h-[min(105vw,900px)] overflow-hidden bg-white"
          aria-labelledby="login-hero-title"
        >
          <img
            src={loginHeroImage}
            alt="Jessiquinha bicampeã mundial ao lado do escudo J12 e do texto App J12"
            className="absolute inset-x-0 top-0 w-full"
          />
          <div className="sr-only">
            <h1 id="login-hero-title">JESSIQUINHA</h1>
            <p>BICAMPEÃ MUNDIAL</p>
            <p>App J12</p>
          </div>
        </section>

        <section className="relative z-10 -mt-1 space-y-7 bg-[#030303] px-6 pb-10 sm:space-y-9 sm:px-[54px] sm:pb-14">
          <nav aria-label="Atalhos do App J12">
            <div className="grid grid-cols-4 gap-3 sm:gap-4">
              {featureCards.map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => handleFeatureNavigation(card.to)}
                  className="group flex aspect-[0.98] min-h-[86px] flex-col items-center justify-center gap-2 rounded-2xl border border-white/25 bg-[linear-gradient(145deg,rgba(20,20,20,0.95),rgba(3,3,3,0.98))] px-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_45px_-35px_rgba(255,102,0,0.9)] outline-none transition hover:border-[#FF6600] hover:bg-[#140903] focus-visible:border-[#FF6600] focus-visible:ring-4 focus-visible:ring-[#FF6600]/35 sm:min-h-[204px] sm:gap-5 sm:rounded-[18px]"
                  aria-label={`Abrir ${card.label}`}
                >
                  <card.icon
                    className="h-8 w-8 text-[#FF6600] transition group-hover:scale-105 sm:h-16 sm:w-16"
                    strokeWidth={card.label === "Financeiro" ? 2.4 : 2.8}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold leading-tight text-white sm:text-3xl">
                    {card.label}
                  </span>
                </button>
              ))}
            </div>
          </nav>

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-7" aria-label="Login J12">
            <div>
              <label htmlFor="login-email" className="sr-only">
                E-mail
              </label>
              <div
                className={`flex h-[70px] items-center gap-4 rounded-2xl border bg-[linear-gradient(145deg,rgba(18,18,18,0.96),rgba(7,7,7,0.98))] px-5 transition focus-within:border-[#FF6600] focus-within:ring-4 focus-within:ring-[#FF6600]/20 sm:h-[108px] sm:gap-7 sm:rounded-[18px] sm:px-8 ${
                  errors.email ? "border-red-500/70" : "border-white/25"
                }`}
              >
                <Mail className="h-7 w-7 shrink-0 text-[#FF6600] sm:h-10 sm:w-10" aria-hidden />
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
                  className="h-full min-w-0 flex-1 bg-transparent text-lg font-medium text-white outline-none placeholder:text-white/38 sm:text-3xl"
                />
              </div>
              {errors.email ? (
                <p id="login-email-error" className="mt-2 text-sm font-medium text-red-300">
                  {errors.email}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="login-password" className="sr-only">
                Senha
              </label>
              <div
                className={`flex h-[70px] items-center gap-4 rounded-2xl border bg-[linear-gradient(145deg,rgba(18,18,18,0.96),rgba(7,7,7,0.98))] px-5 transition focus-within:border-[#FF6600] focus-within:ring-4 focus-within:ring-[#FF6600]/20 sm:h-[108px] sm:gap-7 sm:rounded-[18px] sm:px-8 ${
                  errors.senha ? "border-red-500/70" : "border-white/25"
                }`}
              >
                <LockKeyhole
                  className="h-7 w-7 shrink-0 text-[#FF6600] sm:h-10 sm:w-10"
                  aria-hidden
                />
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
                  className="h-full min-w-0 flex-1 bg-transparent text-lg font-medium text-white outline-none placeholder:text-white/38 sm:text-3xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="rounded-full p-2 text-white outline-none transition hover:text-[#FF6600] focus-visible:ring-4 focus-visible:ring-[#FF6600]/35"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="h-7 w-7 sm:h-11 sm:w-11" />
                  ) : (
                    <Eye className="h-7 w-7 sm:h-11 sm:w-11" />
                  )}
                </button>
              </div>
              {errors.senha ? (
                <p id="login-password-error" className="mt-2 text-sm font-medium text-red-300">
                  {errors.senha}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-4">
              <label className="flex cursor-pointer items-center gap-3 text-base font-medium text-white sm:gap-5 sm:text-2xl">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(event) => setRememberLogin(event.target.checked)}
                  className="h-7 w-7 shrink-0 rounded border border-white/60 bg-transparent accent-[#FF6600] outline-none focus-visible:ring-4 focus-visible:ring-[#FF6600]/35 sm:h-10 sm:w-10"
                  aria-label="Lembrar meus dados"
                />
                <span>Lembrar meus dados</span>
              </label>

              <Link
                to="/forgot-password"
                className="text-right text-base font-semibold text-[#FF6600] outline-none transition hover:text-[#ff9a3d] focus-visible:rounded-md focus-visible:ring-4 focus-visible:ring-[#FF6600]/35 sm:text-2xl"
              >
                Esqueci minha senha
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              className="flex h-[72px] w-full items-center justify-center gap-4 rounded-2xl bg-[#FF6600] px-6 text-2xl font-semibold text-white shadow-[0_28px_75px_-35px_rgba(255,102,0,1)] outline-none transition hover:bg-[#ff7a1f] focus-visible:ring-4 focus-visible:ring-[#FF6600]/40 disabled:cursor-not-allowed disabled:opacity-65 sm:h-[100px] sm:rounded-[15px] sm:text-4xl"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin sm:h-8 sm:w-8" aria-hidden />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-7 w-7 sm:h-12 sm:w-12" aria-hidden />
                </>
              )}
            </button>

            <div className="flex items-center gap-4 text-lg font-medium text-white sm:text-2xl">
              <span className="h-px flex-1 bg-white/30" />
              <span>ou</span>
              <span className="h-px flex-1 bg-white/30" />
            </div>

            <Link
              to="/primeiro-acesso"
              className="flex h-[66px] w-full items-center justify-center gap-4 rounded-2xl border border-[#FF6600] bg-transparent px-5 text-lg font-semibold text-white outline-none transition hover:bg-[#FF6600]/10 focus-visible:ring-4 focus-visible:ring-[#FF6600]/35 sm:h-[84px] sm:rounded-[14px] sm:text-3xl"
            >
              <UserPlus className="h-8 w-8 sm:h-12 sm:w-12" aria-hidden />
              Primeiro acesso
            </Link>

            <p className="text-center text-lg font-medium text-white/62 sm:text-3xl">
              Ainda não é aluno?{" "}
              <Link
                to="/matricula"
                className="font-semibold text-[#FF6600] outline-none transition hover:text-[#ff9a3d] focus-visible:rounded-md focus-visible:ring-4 focus-visible:ring-[#FF6600]/35"
              >
                Matricule-se
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
