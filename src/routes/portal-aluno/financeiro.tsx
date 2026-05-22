import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, CreditCard, FileText, Wallet } from "lucide-react";

import { PortalAlunoLayout } from "@/components/PortalAlunoLayout";
import { PortalHero, PortalKpiCard } from "@/components/shared/PortalPrimitives";
import { useFinanceiroAluno } from "@/hooks/useFinanceiroAluno";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal-aluno/financeiro")({
  component: FinanceiroAlunoPage,
});

function formatCurrency(value: number | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatDate(value: string | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "pago") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (normalized === "vencido" || normalized === "atrasado") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }
  return "border-primary/30 bg-primary/10 text-primary";
}

function FinanceiroAlunoPage() {
  const { dados, loading, erro } = useFinanceiroAluno();

  return (
    <PortalAlunoLayout>
      <div className="j12-page-enter space-y-6">
        <PortalHero
          eyebrow="Financeiro"
          title="Mensalidades e pagamentos"
          description="Consulte cobrancas, vencimentos e status financeiro com a mesma experiencia do portal admin."
        />

        {loading ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="j12-skeleton h-32" />
              <div className="j12-skeleton h-32" />
              <div className="j12-skeleton h-32" />
            </div>
            <div className="j12-skeleton h-80" />
          </div>
        ) : erro ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {erro}
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <PortalKpiCard
                label="Total em aberto"
                value={formatCurrency(dados?.resumo.total_aberto)}
                detail="Cobrancas pendentes"
                icon={Wallet}
                tone="warning"
              />
              <PortalKpiCard
                label="Total pago"
                value={formatCurrency(dados?.resumo.total_pago)}
                detail="Historico quitado"
                icon={CheckCircle2}
                tone="success"
              />
              <PortalKpiCard
                label="Pendentes"
                value={String(dados?.resumo.pendentes || 0)}
                detail="Mensalidades em aberto"
                icon={CreditCard}
              />
            </section>

            {!dados?.mensalidades.length ? (
              <div className="j12-empty-state p-8 text-center text-slate-300">
                Nenhuma cobranca encontrada.
              </div>
            ) : (
              <section className="j12-surface p-4 md:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Mensalidades</h2>
                    <p className="text-sm text-slate-400">
                      {dados.mensalidades.length} registro(s) no seu financeiro.
                    </p>
                  </div>
                  <FileText className="h-5 w-5 text-primary" />
                </div>

                <div className="hidden overflow-hidden rounded-2xl border border-white/10 lg:block">
                  <table className="w-full">
                    <thead className="j12-table-head">
                      <tr className="text-left text-xs uppercase tracking-[0.14em]">
                        <th className="px-4 py-4">Competencia</th>
                        <th className="px-4 py-4">Valor</th>
                        <th className="px-4 py-4">Status</th>
                        <th className="px-4 py-4">Vencimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.mensalidades.map((item) => (
                        <tr key={item.id} className="j12-table-row border-t border-white/8">
                          <td className="px-4 py-4 font-semibold text-white">
                            {item.competencia || "Mensalidade J12"}
                          </td>
                          <td className="px-4 py-4 text-slate-200">
                            {formatCurrency(item.valor)}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize",
                                statusClass(item.status),
                              )}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-300">
                            {formatDate(item.vencimento)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 lg:hidden">
                  {dados.mensalidades.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-white">
                            {item.competencia || "Mensalidade J12"}
                          </h3>
                          <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                            <CalendarDays className="h-4 w-4 text-primary" />
                            {formatDate(item.vencimento)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-bold capitalize",
                            statusClass(item.status),
                          )}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-4 text-2xl font-bold text-primary">
                        {formatCurrency(item.valor)}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </PortalAlunoLayout>
  );
}
