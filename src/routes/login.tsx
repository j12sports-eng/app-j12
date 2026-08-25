import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, GraduationCap, KeyRound, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";

import logoUrl from "@/assets/logo.png?url";
import { Skeleton } from "@/components/ui/skeleton";
import { getRoleHomePath, useAuth } from "@/lib/auth";
import { logSsr, logSsrRoute } from "@/lib/ssr-debug";

const REMEMBER_LOGIN_KEY = "j12:login:remember";
const REMEMBER_EMAIL_KEY = "j12:login:email";

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
    <main className="relative min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.14),transparent_42%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-24 top-1/3 h-64 w-64 rounded-full bg-orange-500/5 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex min-h-screen items-center justify-center py-8 sm:px-6 sm:py-12">
        <section
          className="relative w-[92%] max-w-[29rem] overflow-hidden rounded-[2rem] border border-white/10 bg-[#111111]/95 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.55)] backdrop-blur sm:w-full sm:p-8"
          aria-labelledby="login-title"
        >
          <div
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600"
            aria-hidden="true"
          />

          <header className="mb-7 text-center sm:mb-8">
            <img
              src={logoUrl}
              alt="J12 Sports Hub"
              className="mx-auto mb-4 h-20 w-auto max-w-[11rem] object-contain sm:h-24"
            />
            <h1 id="login-title" className="text-2xl font-black tracking-tight sm:text-3xl">
              Bem-vindo à J12
            </h1>
            <p className="mt-2 text-sm text-zinc-400 sm:text-base">
              Acesse sua conta para continuar
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-5" aria-label="Login J12">
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-semibold text-zinc-200">
                E-mail
              </label>
              <div
                className={`flex min-h-13 items-center rounded-2xl border bg-black/40 px-4 transition focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/10 ${
                  errors.email ? "border-red-500/80" : "border-white/10"
                }`}
              >
                <Mail className="h-5 w-5 shrink-0 text-orange-400" aria-hidden />
                <input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
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
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-white outline-none placeholder:text-zinc-600"
                />
              </div>
              {errors.email ? (
                <p id="login-email-error" className="text-xs font-medium text-red-400">
                  {errors.email}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-semibold text-zinc-200">
                Senha
              </label>
              <div
                className={`flex min-h-13 items-center rounded-2xl border bg-black/40 px-4 transition focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/10 ${
                  errors.senha ? "border-red-500/80" : "border-white/10"
                }`}
              >
                <LockKeyhole className="h-5 w-5 shrink-0 text-orange-400" aria-hidden />
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
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-white outline-none placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/5 hover:text-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.senha ? (
                <p id="login-password-error" className="text-xs font-medium text-red-400">
                  {errors.senha}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-zinc-400">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(event) => setRememberLogin(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-black accent-orange-500"
                  aria-label="Lembrar meus dados"
                />
                <span>Lembrar meus dados</span>
              </label>

              <Link
                to="/forgot-password"
                className="rounded-lg px-1 py-2 font-semibold text-orange-400 transition hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                Esqueci minha senha
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-base font-black text-black shadow-[0_14px_35px_rgba(249,115,22,0.24)] transition hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                "Entrando..."
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </>
              )}
            </button>

            <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              <span className="h-px flex-1 bg-white/10" />
              <span>Novo por aqui?</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleFeatureNavigation("/matricula")}
                className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border border-orange-500/80 bg-orange-500/5 px-5 py-3 text-base font-bold text-orange-400 transition hover:bg-orange-500/10 hover:text-orange-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/20"
              >
                <GraduationCap className="h-5 w-5" aria-hidden />
                Fazer matrícula
              </button>

              <button
                type="button"
                onClick={() => handleFeatureNavigation("/primeiro-acesso")}
                className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-base font-bold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/20"
              >
                <KeyRound className="h-5 w-5 text-orange-400" aria-hidden />
                Primeiro acesso
              </button>
            </div>
          </form>

          <footer className="mt-7 border-t border-white/5 pt-5 text-center text-xs text-zinc-600">
            © J12 Sports. Todos os direitos reservados.
          </footer>
        </section>
      </div>
    </main>
  );
}

function LoginSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-x-hidden bg-[#050505] py-8 sm:px-6 sm:py-12">
      <section
        className="w-[92%] max-w-[29rem] rounded-[2rem] border border-white/10 bg-[#111111] p-5 sm:w-full sm:p-8"
        role="status"
        aria-busy="true"
      >
        <div className="flex flex-col items-center">
          <Skeleton className="h-20 w-28 rounded-2xl sm:h-24" />
          <Skeleton className="mt-5 h-8 w-56 rounded-xl" />
          <Skeleton className="mt-3 h-5 w-64 max-w-full rounded-lg" />
        </div>

        <div className="mt-8 space-y-5">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-13 w-full rounded-2xl" />
            </div>
          ))}
          <div className="flex justify-between gap-4">
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-5 w-36 rounded" />
          </div>
          <Skeleton className="h-13 w-full rounded-2xl" />
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-13 w-full rounded-2xl" />
          <Skeleton className="h-13 w-full rounded-2xl" />
        </div>
        <span className="sr-only">Carregando login J12</span>
      </section>
    </main>
  );
}
