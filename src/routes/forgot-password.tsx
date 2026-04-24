import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, MailCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AuthButton,
  AuthCardHeader,
  AuthExperience,
  AuthInput,
} from "@/components/public/AuthExperience";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<{
    email: string;
    resetUrl: string;
    expiresAt?: string;
  } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Informe seu e-mail.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Digite um e-mail válido.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestPasswordReset(email.trim().toLowerCase());
      setSubmitted({
        email: email.trim().toLowerCase(),
        resetUrl: result.previewUrl ?? "",
      });
      toast.success(result.message || "Processo de recuperação iniciado.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível iniciar a recuperação de senha.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthExperience
      eyebrow="Recuperação de acesso"
      title="Redefina sua senha sem sair do ritmo."
      description="Informe o e-mail cadastrado para gerar um link seguro de redefinição e continuar acessando a operação da J12."
    >
      <AuthCardHeader
        title="Recuperar senha"
        description="Nós validamos se o e-mail existe, geramos um token temporário e liberamos o link de redefinição."
      />

      {submitted ? (
        <div className="space-y-5 rounded-[28px] border border-[#ff6b00]/20 bg-[#ff6b00]/8 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#ff6b00]/15 p-3 text-[#ff9f6b]">
              <MailCheck className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Recuperação iniciada</h3>
              <p className="text-sm leading-6 text-white/70">
                E-mail validado para <strong className="text-white">{submitted.email}</strong>.
                {submitted.resetUrl
                  ? "Use o link abaixo para seguir para a redefinição."
                  : "Se o e-mail estiver configurado corretamente, o link de redefinição já foi enviado."}
              </p>
            </div>
          </div>

          {submitted.resetUrl ? (
            <a
              href={submitted.resetUrl}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/82 transition hover:border-[#ff6b00]/35 hover:bg-[#ff6b00]/10"
            >
              <span>{submitted.resetUrl}</span>
              <ArrowRight className="h-4 w-4 text-[#ff9f6b]" />
            </a>
          ) : null}

          <p className="text-xs text-white/45">
            Em produção com o provedor configurado, o link segue por e-mail real. Em ambiente local,
            quando o envio estiver desabilitado, mostramos o link acima para teste.
          </p>

          <div className="flex gap-3">
            <Link
              to="/login"
              className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-transparent px-4 text-sm font-semibold text-white/72 transition hover:bg-white/5"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao login
            </Link>
            {submitted.resetUrl ? (
              <a
                href={submitted.resetUrl}
                className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#ff6b00,#ff4500)] px-4 text-sm font-semibold text-white shadow-[0_20px_50px_-24px_rgba(255,107,0,0.95)] transition hover:brightness-110"
              >
                Redefinir agora
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <AuthInput
            label="E-mail cadastrado"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="seuemail@j12sports.com.br"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError("");
            }}
            error={error || undefined}
          />

          <AuthButton type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validando e-mail...
              </>
            ) : (
              <>
                Iniciar recuperação
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </AuthButton>

          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-white/58 transition hover:text-[#ff9f6b]">
            <ArrowLeft className="h-4 w-4" />
            Voltar para login
          </Link>
        </form>
      )}
    </AuthExperience>
  );
}
