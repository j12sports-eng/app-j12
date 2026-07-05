import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, CalendarDays, QrCode, ShieldCheck, UserRound } from "lucide-react";

import { PortalAlunoLayout } from "@/components/PortalAlunoLayout";
import { PortalHero, PortalKpiCard } from "@/components/shared/PortalPrimitives";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { usePortalCarteirinha } from "@/lib/aluno-portal";

export const Route = createFileRoute("/portal-aluno/carteirinha")({
  component: CarteirinhaAlunoPage,
});

function CarteirinhaAlunoPage() {
  const { data, loading, error } = usePortalCarteirinha(true);

  return (
    <PortalAlunoLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Carteirinha Digital"
          title="Identificacao do aluno"
          description="QR Code, dados do aluno e status da matricula para conferencia operacional."
        />

        {loading ? (
          <SkeletonDashboard cards={3} panels={1} withHero={false} />
        ) : error || !data ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {error || "Nao foi possivel carregar a carteirinha."}
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <PortalKpiCard
                label="Matricula"
                value={data.matricula.numero || "-"}
                detail="Numero operacional"
                icon={BadgeCheck}
              />
              <PortalKpiCard
                label="Status"
                value={data.statusMatricula || data.matricula.status || "-"}
                detail="Situacao da matricula"
                icon={ShieldCheck}
                tone="success"
              />
              <PortalKpiCard
                label="Plano"
                value={data.matricula.plano || "-"}
                detail="Vinculo atual"
                icon={CalendarDays}
                tone="warning"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="j12-surface p-5 md:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <span className="j12-icon-chip h-11 w-11">
                    <QrCode className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-white">QR Code</h2>
                    <p className="text-sm text-slate-400">Identificador seguro da carteirinha.</p>
                  </div>
                </div>

                <div className="flex justify-center rounded-2xl border border-white/10 bg-white p-5">
                  {data.qrCodeDataUrl ? (
                    <img
                      src={data.qrCodeDataUrl}
                      alt="QR Code da carteirinha digital"
                      className="h-56 w-56"
                    />
                  ) : (
                    <div className="flex h-56 w-56 items-center justify-center text-center text-sm font-bold text-slate-700">
                      QR Code indisponivel
                    </div>
                  )}
                </div>
              </div>

              <div className="j12-surface p-5 md:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <span className="j12-icon-chip h-11 w-11">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-white">Dados do aluno</h2>
                    <p className="text-sm text-slate-400">Informacoes exibidas na carteirinha.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-5 md:flex-row">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    {data.aluno.fotoUrl ? (
                      <img
                        src={data.aluno.fotoUrl}
                        alt={`Foto de ${data.aluno.nome}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserRound className="h-10 w-10 text-slate-500" />
                    )}
                  </div>
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <Info label="Nome" value={data.aluno.nome} />
                    <Info label="Modalidade" value={data.aluno.modalidade || "-"} />
                    <Info label="Turma" value={data.aluno.turma || "-"} />
                    <Info label="Responsavel" value={data.responsavel?.nome || "-"} />
                    <Info label="Desde" value={formatDate(data.matricula.desde)} />
                    <Info label="Status" value={data.matricula.status || "-"} />
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </PortalAlunoLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 break-words font-bold text-white">{value || "-"}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
