import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  AuthButton,
  AuthCardHeader,
  AuthExperience,
  AuthInput,
} from "@/components/public/AuthExperience";
import { useAuth } from "@/lib/auth";
import { mysqlApi } from "@/lib/mysql-api";

export const Route = createFileRoute("/reset-password/$token")({
  component: ResetPasswordPage,
});

type TokenValidation = {
  valid: boolean;
  email: string;
  login?: string;
  expiresAt: string;
};

function passwordStrengthLabel(password: string) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
  ];

  const score = checks.filter(Boolean).length;
  if (score <= 1) return "Fraca";
  if (score <= 3) return "Boa";
  return "Forte";
}

function ResetPasswordPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loadingToken, setLoadingToken] = useState(true);
  const [tokenError, setTokenError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validation, setValidation] = useState<TokenValidation | null>(null);
  const [errors, setErrors] = useState<{ senha?: string; confirmarSenha?: string }>({});

  useEffect(() => {
    let active = true;

    async function validateToken() {
      setLoadingToken(true);
      setTokenError("");
      try {
        const data = await mysqlApi.get<TokenValidation>(`/auth/reset-password/${token}`);
        if (!active) return;
        setValidation(data);
      } catch (error) {
        if (!active) return;
        setTokenError(
          error instanceof Error ? error.message : "Token inválido ou expirado.",
        );
      } finally {
        if (active) setLoadingToken(false);
      }
    }

    void validateToken();

    return () => {
      active = false;
    };
  }, [token]);

  const strength = useMemo(() => passwordStrengthLabel(senha), [senha]);

  function validateForm() {
    const nextErrors: typeof errors = {};

    if (!senha) {
      nextErrors.senha = "Informe a nova senha.";
    } else if (
      senha.length < 8 ||
      !/[A-Z]/.test(senha) ||
      !/[a-z]/.test(senha) ||
      !/\d/.test(senha)
    ) {
      nextErrors.senha =
        "Use no mínimo 8 caracteres com letra maiúscula, minúscula e número.";
    }

    if (!confirmarSenha) {
      nextErrors.confirmarSenha = "Confirme a nova senha.";
    } else if (confirmarSenha !== senha) {
      nextErrors.confirmarSenha = "A confirmação da senha não confere.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await resetPassword(token, senha, confirmarSenha);
      setSuccess(true);
      toast.success("Senha alterada com sucesso.");
      window.setTimeout(() => {
        navigate({ to: "/login" });
      }, 1600);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao redefinir senha.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthExperience
      eyebrow="Redefinição segura"
      title="Crie uma nova senha forte e volte para o jogo."
      description="Seu token é validado antes da troca e a nova senha só é aplicada quando todos os critérios de segurança forem atendidos."
    >
      <AuthCardHeader
        title="Redefinir senha"
        description="Preencha a nova senha e confirme. Após salvar, você será redirecionado automaticamente para a tela de login."
      />

      {loadingToken ? (
        <div className="flex min-h-56 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-3 text-sm text-white/70">
            <Loader2 className="h-4 w-4 animate-spin text-[#ff9f6b]" />
            Validando token de recuperação...
          </div>
        </div>
      ) : tokenError ? (
        <div className="space-y-5 rounded-[28px] border border-red-500/25 bg-red-500/8 p-5">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">Link inválido ou expirado</h3>
            <p className="text-sm leading-6 text-white/70">{tokenError}</p>
          </div>

          <Link
            to="/forgot-password"
            className="inline-flex h-13 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff6b00,#ff4500)] px-4 text-sm font-semibold text-white shadow-[0_20px_50px_-24px_rgba(255,107,0,0.95)] transition hover:brightness-110"
          >
            Gerar novo link de recuperação
          </Link>
        </div>
      ) : success ? (
        <div className="space-y-4 rounded-[28px] border border-emerald-500/25 bg-emerald-500/10 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Senha alterada com sucesso.</h3>
              <p className="text-sm leading-6 text-white/70">
                Redirecionando você para o login da J12...
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-white">
              <ShieldCheck className="h-4 w-4 text-[#ff9f6b]" />
              Token válido para
            </div>
            <div className="text-sm text-white/72">{validation?.email}</div>
          </div>

          <AuthInput
            label="Nova senha"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Crie uma senha forte"
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

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/60">
            Força da senha: <span className="font-semibold text-[#ffb07e]">{strength}</span>
          </div>

          <AuthInput
            label="Confirmar nova senha"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repita a nova senha"
            value={confirmarSenha}
            onChange={(event) => {
              setConfirmarSenha(event.target.value);
              if (errors.confirmarSenha) {
                setErrors((current) => ({ ...current, confirmarSenha: undefined }));
              }
            }}
            error={errors.confirmarSenha}
            rightSlot={
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="rounded-full p-1 text-white/45 transition hover:text-[#ff9f6b]"
                aria-label={showConfirmPassword ? "Ocultar confirmação" : "Mostrar confirmação"}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            }
          />

          <AuthButton type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando nova senha...
              </>
            ) : (
              "Salvar nova senha"
            )}
          </AuthButton>

          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/58 transition hover:text-[#ff9f6b]"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para login
          </Link>
        </form>
      )}
    </AuthExperience>
  );
}
