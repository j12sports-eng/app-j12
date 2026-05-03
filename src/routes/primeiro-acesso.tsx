import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  AuthButton,
  AuthCardHeader,
  AuthExperience,
  AuthInput,
} from "@/components/public/AuthExperience";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/primeiro-acesso")({
  component: PrimeiroAcessoPage,
});

function PrimeiroAcessoPage() {
  const navigate = useNavigate();
  const { completeFirstAccess } = useAuth();
  const [numeroMatricula, setNumeroMatricula] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [email, setEmail] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!numeroMatricula || !dataNascimento || !email || !senha || !confirmarSenha) {
      setError("Preencha os dados obrigatorios para concluir o primeiro acesso.");
      return;
    }

    setSubmitting(true);
    try {
      await completeFirstAccess({
        numeroMatricula,
        dataNascimento,
        email,
        login: login || email,
        senha,
        confirmarSenha,
      });
      toast.success("Primeiro acesso configurado. Agora voce ja pode entrar.");
      navigate({ to: "/login" });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Falha ao concluir primeiro acesso.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthExperience
      eyebrow="Primeiro acesso"
      title="Ative sua conta J12 com seguranca e autonomia."
      description="Use seu numero de matricula e data de nascimento para validar o vinculo do aluno e definir a senha inicial."
    >
      <AuthCardHeader
        title="Criar senha inicial"
        description="Depois de concluir o primeiro acesso, seu login passara a funcionar normalmente na area do aluno ou do responsavel."
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
          <div className="mb-2 flex items-center gap-2 font-medium text-white">
            <ShieldCheck className="h-4 w-4 text-[#ff9f6b]" />
            Validacao do cadastro
          </div>
          Use o numero de matricula e a data de nascimento do aluno para validar o primeiro acesso.
        </div>

        <AuthInput
          label="Numero de matricula"
          type="text"
          value={numeroMatricula}
          onChange={(event) => setNumeroMatricula(event.target.value)}
          placeholder="Ex.: 123"
        />

        <AuthInput
          label="Data de nascimento"
          type="date"
          value={dataNascimento}
          onChange={(event) => setDataNascimento(event.target.value)}
        />

        <AuthInput
          label="E-mail"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seuemail@j12sports.com.br"
        />

        <AuthInput
          label="Login (opcional)"
          type="text"
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          placeholder="Se quiser, defina um login diferente do e-mail"
        />

        <AuthInput
          label="Senha"
          type="password"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          placeholder="Crie uma senha forte"
        />

        <AuthInput
          label="Confirmar senha"
          type="password"
          value={confirmarSenha}
          onChange={(event) => setConfirmarSenha(event.target.value)}
          placeholder="Repita a senha"
        />

        {error ? <div className="text-sm text-red-300">{error}</div> : null}

        <AuthButton type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Validando cadastro...
            </>
          ) : (
            <>
              Concluir primeiro acesso
              <ArrowRight className="h-4 w-4" />
            </>
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
    </AuthExperience>
  );
}
