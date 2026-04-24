import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import {
  AuthButton,
  AuthCardHeader,
  AuthDivider,
  AuthExperience,
  AuthInput,
} from "@/components/public/AuthExperience";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; senha?: string }>({});

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, user, navigate]);

  const accounts = useMemo(
    () => [
      "admin@j12.com",
      "coord@j12.com",
      "prof@j12.com",
      "aluno@j12.com",
      "responsavel@j12.com",
    ],
    [],
  );

  function validate() {
    const nextErrors: typeof errors = {};
    if (!email.trim()) {
      nextErrors.email = "Informe seu login ou e-mail.";
    }

    if (!senha.trim()) {
      nextErrors.senha = "Informe sua senha.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login(email.trim(), senha);
      toast.success("Bem-vindo de volta.");
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao entrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthExperience
      eyebrow="Acesso central J12"
      title="Entre no hub operacional da J12 com segurança e ritmo de jogo."
      description="Acompanhe alunos, contratos, financeiro e rotinas da operação em uma experiência premium, rápida e totalmente responsiva."
      footer={
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/35">
            Contas de teste
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {accounts.map((account) => (
              <button
                key={account}
                type="button"
                onClick={() => setEmail(account)}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/72 transition hover:border-[#ff6b00]/35 hover:bg-[#ff6b00]/10 hover:text-white"
              >
                {account}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/45">
            Use as credenciais ativas do seu ambiente ou conclua o primeiro acesso para criar sua senha.
          </p>
        </div>
      }
    >
      <AuthCardHeader
        title="Bem-vindo à J12"
        description="Use seu e-mail e senha para acessar a plataforma. Se precisar, recupere seu acesso em poucos passos ou abra uma nova matrícula pública."
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthInput
          label="Login ou e-mail"
          type="text"
          inputMode="email"
          autoComplete="username"
          placeholder="seuemail@j12sports.com.br"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
          }}
          error={errors.email}
        />

        <AuthInput
          label="Senha"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Digite sua senha"
          value={senha}
          onChange={(event) => {
            setSenha(event.target.value);
            if (errors.senha) setErrors((current) => ({ ...current, senha: undefined }));
          }}
          error={errors.senha}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="rounded-full p-1 text-white/45 transition hover:text-[#ff9f6b]"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-[#ff9f6b] transition hover:text-[#ffd0b0]"
          >
            Esqueci minha senha
          </Link>
        </div>

        <AuthButton type="submit" disabled={submitting || loading}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Entrar
            </>
          )}
        </AuthButton>

        <AuthDivider label="Novo por aqui" />

        <Link
          to="/matricula"
          className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-[#ff6b00]/35 bg-white/[0.03] px-4 text-sm font-semibold text-[#ffb07e] transition hover:bg-[#ff6b00]/12"
        >
          Matrícula
          <ArrowRight className="h-4 w-4" />
        </Link>

        <Link
          to="/primeiro-acesso"
          className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 text-sm font-semibold text-white/75 transition hover:border-[#ff6b00]/35 hover:bg-[#ff6b00]/10 hover:text-white"
        >
          Primeiro acesso
          <ArrowRight className="h-4 w-4" />
        </Link>
      </form>
    </AuthExperience>
  );
}
