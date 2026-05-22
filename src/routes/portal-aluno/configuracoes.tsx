import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Mail, Phone, Save, ShieldCheck, UserCog } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { PortalAlunoLayout } from "@/components/PortalAlunoLayout";
import { PortalHero } from "@/components/shared/PortalPrimitives";
import { usePerfilAluno } from "@/hooks/usePerfilAluno";

export const Route = createFileRoute("/portal-aluno/configuracoes")({
  component: ConfiguracoesAlunoPage,
});

function ConfiguracoesAlunoPage() {
  const { perfil, loading, erro, salvarPerfil } = usePerfilAluno();
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    setEmail(perfil.email_contato || "");
    setTelefone(perfil.telefone_contato || "");
  }, [perfil]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const ok = await salvarPerfil({
        email_contato: email,
        telefone_contato: telefone,
      });

      if (ok) {
        toast.success("Perfil atualizado com sucesso.");
      } else {
        toast.error("Nao foi possivel atualizar o perfil.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalAlunoLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Configuracoes"
          title="Preferencias da conta"
          description="Atualize contatos e acesse a seguranca da conta usando o mesmo padrao do sistema J12."
        />

        {loading ? (
          <div className="j12-skeleton h-96" />
        ) : erro || !perfil ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {erro || "Nao foi possivel carregar as configuracoes."}
          </div>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
            <form onSubmit={handleSubmit} className="j12-surface p-5 md:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="j12-icon-chip h-11 w-11">
                  <UserCog className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">Dados de contato</h2>
                  <p className="text-sm text-slate-400">Informacoes usadas pela operacao J12.</p>
                </div>
              </div>

              <div className="grid gap-4">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Email</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="j12-field min-h-12 w-full pl-10 pr-4 text-sm"
                    />
                  </div>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Telefone</span>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="tel"
                      value={telefone}
                      onChange={(event) => setTelefone(event.target.value)}
                      className="j12-field min-h-12 w-full pl-10 pr-4 text-sm"
                    />
                  </div>
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar alteracoes
              </button>
            </form>

            <aside className="j12-surface p-5 md:p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="j12-icon-chip h-11 w-11">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">Seguranca</h2>
                  <p className="text-sm text-slate-400">Controle de acesso do portal.</p>
                </div>
              </div>
              <Link
                to="/trocar-senha"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Trocar senha
              </Link>
            </aside>
          </section>
        )}
      </div>
    </PortalAlunoLayout>
  );
}
