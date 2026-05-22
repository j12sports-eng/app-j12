import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, ShieldCheck, UserCog, Users } from "lucide-react";

import { PortalResponsavelLayout } from "@/components/PortalResponsavelLayout";
import { PortalHero, PortalKpiCard } from "@/components/shared/PortalPrimitives";
import { useResponsavelAlunos } from "@/hooks/useResponsavelAlunos";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/portal-responsavel/configuracoes")({
  component: ConfiguracoesResponsavelPage,
});

function ConfiguracoesResponsavelPage() {
  const { user } = useAuth();
  const { alunos } = useResponsavelAlunos();

  return (
    <PortalResponsavelLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Configuracoes"
          title="Preferencias da familia"
          description="Conta, seguranca e preferencias de acompanhamento no mesmo padrao do sistema J12."
        />

        <section className="grid gap-4 md:grid-cols-3">
          <PortalKpiCard
            label="Conta"
            value={user?.nome || "Responsavel"}
            detail={user?.email || "Email nao informado"}
            icon={UserCog}
          />
          <PortalKpiCard
            label="Alunos"
            value={String(alunos.length)}
            detail="Vinculos acompanhados"
            icon={Users}
            tone="success"
          />
          <PortalKpiCard
            label="Comunicados"
            value="Ativos"
            detail="Central de avisos habilitada"
            icon={Bell}
            tone="warning"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
          <div className="j12-surface p-5 md:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="j12-icon-chip h-11 w-11">
                <UserCog className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-white">Conta familiar</h2>
                <p className="text-sm text-slate-400">Resumo do acesso do responsavel.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <InfoLine label="Nome" value={user?.nome || "-"} />
              <InfoLine label="Email" value={user?.email || "-"} />
              <InfoLine label="Perfil" value="Responsavel" />
              <InfoLine label="Alunos vinculados" value={String(alunos.length)} />
            </div>
          </div>

          <aside className="j12-surface p-5 md:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="j12-icon-chip h-11 w-11">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-white">Seguranca</h2>
                <p className="text-sm text-slate-400">Controle de senha do portal.</p>
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
      </div>
    </PortalResponsavelLayout>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 break-words font-bold text-white">{value}</p>
    </div>
  );
}
