import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, CreditCard, FileText, Loader2, QrCode, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import { PortalResponsavelLayout } from "@/components/PortalResponsavelLayout";
import { PortalHero } from "@/components/shared/PortalPrimitives";
import { SkeletonDashboard, SkeletonTable } from "@/components/ui/skeleton";
import { useResponsavelFinanceiro } from "@/hooks/useResponsavelFinanceiro";
import { useResponsavelAlunos } from "@/hooks/useResponsavelAlunos";
import { api, formatApiErrorMessage } from "@/lib/api";

export const Route = createFileRoute("/portal-responsavel/financeiro")({
  component: FinanceiroResponsavelPage,
});

function formatCurrency(value: number | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "pago") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (normalized === "vencido" || normalized === "atrasado") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }
  return "border-primary/30 bg-primary/10 text-primary";
}

type PixPayment = {
  txid: string;
  qrCode: string;
  pixCopiaCola: string;
  valor: string;
  status: string;
  paymentId?: string;
  mensalidadeId?: string;
  chargeId?: string;
};

function FinanceiroResponsavelPage() {
  const { mensalidades, resumo, loading, erro } = useResponsavelFinanceiro();
  const { isFamilyView, selectedStudent } = useResponsavelAlunos();
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null);
  const [creatingPixId, setCreatingPixId] = useState<string | null>(null);

  async function handleGerarPix(item: (typeof mensalidades)[number]) {
    try {
      setCreatingPixId(item.id);
      const response = await api.post<PixPayment>("/pix/create", {
        mensalidadeId: item.id,
        chargeId: item.id,
      });

      setPixPayment(response);
      toast.success("PIX gerado. A baixa sera automatica apos a confirmacao do Banco Inter.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Erro ao gerar PIX Banco Inter"));
    } finally {
      setCreatingPixId(null);
    }
  }

  async function handleCopyPix() {
    if (!pixPayment?.pixCopiaCola) return;

    await navigator.clipboard.writeText(pixPayment.pixCopiaCola);
    toast.success("Codigo PIX copiado.");
  }

  return (
    <PortalResponsavelLayout>
      <div className="j12-page-enter space-y-8">
        <PortalHero
          eyebrow="Financeiro"
          title={isFamilyView ? "Mensalidades da familia" : selectedStudent?.nome || "Mensalidades"}
          description="Cobrancas, pagamentos e pendencias no mesmo padrao operacional do admin."
        />

        {loading ? (
          <div className="space-y-4">
            <SkeletonDashboard cards={3} panels={1} withHero={false} />
            <SkeletonTable columns={4} rows={4} />
          </div>
        ) : erro ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
            {erro}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="j12-kpi-card p-5">
                <Wallet className="mb-4 h-6 w-6 text-primary" />
                <p className="text-sm text-zinc-400">Total em aberto</p>
                <div className="mt-2 text-3xl font-black text-white">
                  {formatCurrency(resumo.totalAberto)}
                </div>
              </div>
              <div className="j12-kpi-card p-5">
                <CreditCard className="mb-4 h-6 w-6 text-emerald-200" />
                <p className="text-sm text-zinc-400">Total pago</p>
                <div className="mt-2 text-3xl font-black text-white">
                  {formatCurrency(resumo.totalPago)}
                </div>
              </div>
              <div className="j12-kpi-card p-5">
                <FileText className="mb-4 h-6 w-6 text-amber-200" />
                <p className="text-sm text-zinc-400">Pendentes</p>
                <div className="mt-2 text-3xl font-black text-white">{resumo.pendentes}</div>
              </div>
            </div>

            {pixPayment ? (
              <section className="j12-surface border-primary/20 p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row">
                    <div className="flex h-44 w-44 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white p-2">
                      {pixPayment.qrCode ? (
                        <img
                          src={pixPayment.qrCode}
                          alt="QRCode PIX Banco Inter"
                          className="h-full w-full rounded-xl object-contain"
                        />
                      ) : (
                        <QrCode className="h-14 w-14 text-zinc-900" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                          {pixPayment.status}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          TXID {pixPayment.txid}
                        </span>
                      </div>
                      <h2 className="mt-3 text-xl font-black text-white">PIX Banco Inter</h2>
                      <p className="mt-1 text-sm text-slate-400">
                        Valor {formatCurrency(Number(pixPayment.valor))}. A confirmacao e a baixa
                        acontecem automaticamente pelo webhook.
                      </p>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                        <p className="line-clamp-3 break-all text-xs text-slate-300">
                          {pixPayment.pixCopiaCola}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void handleCopyPix()}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:brightness-110"
                        >
                          <Copy className="h-4 w-4" />
                          Copiar PIX
                        </button>
                        <button
                          type="button"
                          onClick={() => setPixPayment(null)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
                        >
                          <X className="h-4 w-4" />
                          Fechar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {mensalidades.length === 0 ? (
              <div className="j12-empty-state p-8 text-center text-slate-300">
                Nenhuma cobranca encontrada.
              </div>
            ) : (
              <div className="space-y-3">
                {mensalidades.map((item) => (
                  <article key={item.id} className="j12-surface p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-black text-white">
                            {item.alunoNome}
                          </h3>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(item.status)}`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">
                          {item.descricao || item.competencia || "Mensalidade J12"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Vencimento: {formatDate(item.vencimento)}
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="text-2xl font-black text-primary">
                          {formatCurrency(item.valor)}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleGerarPix(item)}
                          disabled={
                            creatingPixId === item.id || item.status.toLowerCase() === "pago"
                          }
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {creatingPixId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <QrCode className="h-4 w-4" />
                          )}
                          Pagar com Pix
                        </button>
                        <button className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10">
                          Ver boleto
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PortalResponsavelLayout>
  );
}
