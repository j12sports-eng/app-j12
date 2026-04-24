import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/trocar-senha")({
  component: () => (
    <RequireAuth roles={["aluno", "responsavel", "professor", "coordenador", "admin"]}>
      <TrocarSenhaPage />
    </RequireAuth>
  ),
});

function TrocarSenhaPage() {
  const { changePassword } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      setError("Preencha todos os campos para alterar sua senha.");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setError("A confirmacao da nova senha nao confere.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(senhaAtual, novaSenha, confirmarSenha);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
      toast.success("Senha alterada com sucesso.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Falha ao alterar senha.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Trocar Senha">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Trocar Senha</h2>
          <p className="text-sm text-muted-foreground">
            Atualize sua senha com seguranÃ§a. A validaÃ§Ã£o acontece no backend.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="text-sm text-muted-foreground">
              Use uma senha com pelo menos 8 caracteres, incluindo letra maiuscula, minuscula e numero.
            </div>
          </div>

          <div className="grid gap-4">
            <Field
              label="Senha atual"
              type="password"
              value={senhaAtual}
              onChange={setSenhaAtual}
            />
            <Field
              label="Nova senha"
              type="password"
              value={novaSenha}
              onChange={setNovaSenha}
            />
            <Field
              label="Confirmar nova senha"
              type="password"
              value={confirmarSenha}
              onChange={setConfirmarSenha}
            />
          </div>

          {error ? <div className="mt-4 text-sm text-destructive">{error}</div> : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar nova senha"
            )}
          </button>
        </form>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
