import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Trophy, Users } from "lucide-react";

import { PortalResponsavelLayout } from "@/components/PortalResponsavelLayout";
import { StudentProfileSummaryCard } from "@/components/portal-responsavel/StudentProfileSummaryCard";
import { PortalHero, PortalKpiCard } from "@/components/shared/PortalPrimitives";
import { useResponsavelAlunos } from "@/hooks/useResponsavelAlunos";

export const Route = createFileRoute("/portal-responsavel/meus-filhos")({
  component: MeusFilhosPage,
});

function MeusFilhosPage() {
  const { alunos, loading, erro } = useResponsavelAlunos();
  const ativos = alunos.filter((aluno) => String(aluno.status || "").toLowerCase() !== "inativo").length;

  return (
    <PortalResponsavelLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Meus Filhos"
          title="Alunos vinculados"
          description="Resumo dos alunos acompanhados pelo responsavel no mesmo layout premium da J12."
        />

        {loading ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="j12-skeleton h-32" />
              <div className="j12-skeleton h-32" />
              <div className="j12-skeleton h-32" />
            </div>
            <div className="j12-skeleton h-64" />
          </div>
        ) : erro ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {erro}
          </div>
        ) : alunos.length === 0 ? (
          <div className="j12-empty-state p-8 text-center text-slate-300">
            Nenhum aluno vinculado ao responsavel.
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <PortalKpiCard
                label="Filhos matriculados"
                value={String(alunos.length)}
                detail="Vinculos cadastrados"
                icon={Users}
              />
              <PortalKpiCard
                label="Ativos"
                value={String(ativos)}
                detail="Matriculas em acompanhamento"
                icon={ShieldCheck}
                tone="success"
              />
              <PortalKpiCard
                label="Modalidades"
                value={String(new Set(alunos.map((aluno) => aluno.modalidade).filter(Boolean)).size)}
                detail="Atividades diferentes"
                icon={Trophy}
                tone="warning"
              />
            </section>

            <section className={alunos.length > 1 ? "grid gap-4 xl:grid-cols-2" : ""}>
              {alunos.map((aluno) => (
                <StudentProfileSummaryCard
                  key={aluno.id}
                  student={{
                    id: aluno.id,
                    nome: aluno.nome,
                    modalidade: aluno.modalidade,
                    categoria: aluno.categoria || aluno.plano,
                    turma: aluno.turma,
                    professor: aluno.professor,
                    status: aluno.status,
                  }}
                />
              ))}
            </section>
          </>
        )}
      </div>
    </PortalResponsavelLayout>
  );
}
