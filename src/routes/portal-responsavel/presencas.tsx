import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, ShieldCheck, XCircle } from "lucide-react";

import { PortalResponsavelLayout } from "@/components/PortalResponsavelLayout";
import { PortalHero } from "@/components/shared/PortalPrimitives";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { useResponsavelAlunos } from "@/hooks/useResponsavelAlunos";
import { useResponsavelPresencas } from "@/hooks/useResponsavelPresencas";

export const Route = createFileRoute("/portal-responsavel/presencas")({
  component: PresencasResponsavelPage,
});

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "success" | "danger";
}) {
  const toneClass = {
    primary: "text-primary",
    success: "text-emerald-200",
    danger: "text-red-200",
  }[tone];

  return (
    <div className="j12-kpi-card p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <div className={`mt-2 text-3xl font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

function PresencasResponsavelPage() {
  const { resumo, presencas, loading, erro } = useResponsavelPresencas();
  const { isFamilyView, selectedStudent } = useResponsavelAlunos();

  return (
    <PortalResponsavelLayout>
      <div className="j12-page-enter space-y-8">
        <PortalHero
          eyebrow="Frequencia"
          title={isFamilyView ? "Historico da familia" : selectedStudent?.nome || "Historico"}
          description="Presencas, faltas e justificativas com leitura responsiva e consistente."
        />

        {loading ? (
          <SkeletonDashboard cards={4} panels={1} withHero={false} />
        ) : erro ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {erro}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <KpiCard label="Presenca" value={`${resumo.percentual_presenca}%`} tone="primary" />
              <KpiCard label="Presentes" value={String(resumo.presentes)} tone="success" />
              <KpiCard label="Faltas" value={String(resumo.faltas)} tone="danger" />
              <KpiCard label="Justificadas" value={String(resumo.justificadas)} tone="primary" />
            </div>

            {presencas.length === 0 ? (
              <div className="j12-empty-state p-8 text-center text-slate-300">
                Nenhuma presenca registrada.
              </div>
            ) : (
              <div className="space-y-3">
                {presencas.map((item) => {
                  const present = item.status === "presente";

                  return (
                    <article
                      key={item.id}
                      className={`rounded-2xl border bg-card p-5 shadow-[var(--shadow-elegant)] ${
                        present ? "border-emerald-500/25" : "border-red-500/25"
                      }`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {present ? (
                              <ShieldCheck className="h-5 w-5 text-emerald-200" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-200" />
                            )}
                            <h3 className="truncate text-lg font-black text-white">
                              {item.alunoNome}
                            </h3>
                          </div>
                          <p className="mt-2 text-sm text-slate-400">
                            {[item.modalidade, item.turma].filter(Boolean).join(" • ") ||
                              "Treino J12"}
                          </p>
                          {item.observacao && (
                            <p className="mt-2 text-sm text-slate-500">{item.observacao}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-sm font-semibold text-slate-300">
                          <CalendarCheck className="h-4 w-4 text-primary" />
                          {formatDate(item.dataAula)}
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              present
                                ? "bg-emerald-500/10 text-emerald-200"
                                : "bg-red-500/10 text-red-200"
                            }`}
                          >
                            {present ? "Presente" : "Falta"}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </PortalResponsavelLayout>
  );
}
