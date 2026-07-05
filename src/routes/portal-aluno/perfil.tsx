import { createFileRoute } from "@tanstack/react-router";
import { Camera, Mail, Phone, ShieldCheck, Trophy, UserRound, Users } from "lucide-react";
import { type ReactNode } from "react";

import { PortalAlunoLayout } from "@/components/PortalAlunoLayout";
import { PortalHero, PortalKpiCard } from "@/components/shared/PortalPrimitives";
import { SkeletonDashboard, SkeletonForm } from "@/components/ui/skeleton";
import { usePerfilAluno } from "@/hooks/usePerfilAluno";

export const Route = createFileRoute("/portal-aluno/perfil")({
  component: PerfilAlunoPage,
});

function PerfilAlunoPage() {
  const { perfil, loading, erro } = usePerfilAluno();

  return (
    <PortalAlunoLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Meu Perfil"
          title={perfil?.nome_completo || "Perfil do aluno"}
          description="Dados cadastrais e esportivos organizados no padrao visual do portal admin."
        />

        {loading ? (
          <div className="space-y-4">
            <SkeletonDashboard cards={3} panels={0} withHero={false} />
            <SkeletonForm fields={4} withActions={false} />
          </div>
        ) : erro || !perfil ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {erro || "Perfil nao encontrado."}
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <PortalKpiCard
                label="Status"
                value={perfil.status || "-"}
                detail="Situacao da matricula"
                icon={ShieldCheck}
                tone="success"
              />
              <PortalKpiCard
                label="Modalidade"
                value={perfil.modalidade_principal || "-"}
                detail="Modalidade principal"
                icon={Trophy}
              />
              <PortalKpiCard
                label="Contato"
                value={perfil.telefone_contato || "-"}
                detail="Telefone cadastrado"
                icon={Phone}
                tone="warning"
              />
            </section>

            <section className="j12-surface p-5 md:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="j12-icon-chip h-11 w-11">
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">Dados cadastrais</h2>
                  <p className="text-sm text-slate-400">Informacoes principais do aluno.</p>
                </div>
              </div>

              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {perfil.fotoUrl ? (
                    <img
                      src={perfil.fotoUrl}
                      alt={`Foto de ${perfil.nome_completo}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Camera className="h-8 w-8 text-slate-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-400">Matricula</p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {perfil.numero_matricula || "-"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard
                  label="Nome"
                  value={perfil.nome_completo}
                  icon={<UserRound className="h-4 w-4" />}
                />
                <InfoCard
                  label="Email"
                  value={perfil.email_contato}
                  icon={<Mail className="h-4 w-4" />}
                />
                <InfoCard
                  label="Telefone"
                  value={perfil.telefone_contato || "-"}
                  icon={<Phone className="h-4 w-4" />}
                />
                <InfoCard
                  label="Modalidade"
                  value={perfil.modalidade_principal || "-"}
                  icon={<Trophy className="h-4 w-4" />}
                />
                <InfoCard
                  label="Turma"
                  value={perfil.turma_principal || "-"}
                  icon={<ShieldCheck className="h-4 w-4" />}
                />
                <InfoCard
                  label="Plano"
                  value={perfil.plano_principal || "-"}
                  icon={<Trophy className="h-4 w-4" />}
                />
              </div>
            </section>

            <section className="j12-surface p-5 md:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="j12-icon-chip h-11 w-11">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">Dados do responsavel</h2>
                  <p className="text-sm text-slate-400">Contato vinculado ao cadastro do aluno.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard
                  label="Nome"
                  value={perfil.responsavel_detalhes?.nome || "-"}
                  icon={<Users className="h-4 w-4" />}
                />
                <InfoCard
                  label="Parentesco"
                  value={perfil.responsavel_detalhes?.parentesco || "-"}
                  icon={<ShieldCheck className="h-4 w-4" />}
                />
                <InfoCard
                  label="Telefone"
                  value={perfil.responsavel_detalhes?.telefone || "-"}
                  icon={<Phone className="h-4 w-4" />}
                />
                <InfoCard
                  label="Email"
                  value={perfil.responsavel_detalhes?.email || "-"}
                  icon={<Mail className="h-4 w-4" />}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </PortalAlunoLayout>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {icon}
        {label}
      </div>
      <div className="break-words text-base font-bold text-white">{value || "-"}</div>
    </div>
  );
}
