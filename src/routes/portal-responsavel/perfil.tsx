import { createFileRoute } from "@tanstack/react-router";
import { Mail, ShieldCheck, UserRound, Users } from "lucide-react";
import { type ReactNode } from "react";

import { PortalResponsavelLayout } from "@/components/PortalResponsavelLayout";
import { PortalHero, PortalKpiCard } from "@/components/shared/PortalPrimitives";
import { useResponsavelAlunos } from "@/hooks/useResponsavelAlunos";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/portal-responsavel/perfil")({
  component: PerfilResponsavelPage,
});

function PerfilResponsavelPage() {
  const { user } = useAuth();
  const { alunos, loading, erro } = useResponsavelAlunos();

  return (
    <PortalResponsavelLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Perfil"
          title={user?.nome || "Responsavel J12"}
          description="Dados da conta familiar e vinculos acompanhados dentro da plataforma."
        />

        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="j12-skeleton h-32" />
            <div className="j12-skeleton h-32" />
            <div className="j12-skeleton h-32" />
          </div>
        ) : erro ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {erro}
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <PortalKpiCard
                label="Perfil"
                value="Responsavel"
                detail="Tipo de acesso"
                icon={UserRound}
              />
              <PortalKpiCard
                label="Alunos vinculados"
                value={String(alunos.length)}
                detail="Filhos acompanhados"
                icon={Users}
                tone="success"
              />
              <PortalKpiCard
                label="Status"
                value={user?.status || "Ativo"}
                detail="Conta do portal"
                icon={ShieldCheck}
                tone="warning"
              />
            </section>

            <section className="j12-surface p-5 md:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="j12-icon-chip h-11 w-11">
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">Dados da conta</h2>
                  <p className="text-sm text-slate-400">Informacoes usadas para acesso ao portal.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard label="Nome" value={user?.nome || "-"} icon={<UserRound className="h-4 w-4" />} />
                <InfoCard label="Email" value={user?.email || "-"} icon={<Mail className="h-4 w-4" />} />
              </div>
            </section>
          </>
        )}
      </div>
    </PortalResponsavelLayout>
  );
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {icon}
        {label}
      </div>
      <div className="break-words text-base font-bold text-white">{value}</div>
    </div>
  );
}
