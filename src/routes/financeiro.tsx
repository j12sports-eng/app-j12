import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Trash2,
  CheckCircle2,
  Zap,
  RotateCcw,
  Search,
  X,
  TrendingUp,
  AlertTriangle,
  Clock,
  CircleDollarSign,
  PauseCircle,
  PlayCircle,
  Pencil,
  Link2,
  Send,
  ReceiptText,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { ResourceSyncBanner } from "@/components/shared/ResourceSyncBanner";
import { CobrancaDialog } from "@/components/financeiro/CobrancaDialog";
import { BaixaDialog } from "@/components/financeiro/BaixaDialog";
import {
  calcStatus,
  financeiroStore,
  formatBRL,
  getRecorrenciaAluno,
  getValorAtualizado,
  listMonths,
  monthLabel,
  useRecorrenciasFinanceiras,
  useFinanceiroStatus,
  useTransacoes,
  type StatusCobranca,
  type TipoLancamento,
  type Transacao,
} from "@/lib/financeiro-store";
import { useAuth } from "@/lib/auth";
import { usePortalAluno, usePortalFinanceiro } from "@/lib/aluno-portal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/financeiro")({
  component: () => (
    <RequireAuth roles={["admin", "coordenador", "aluno", "responsavel"]}>
      <FinanceiroPage />
    </RequireAuth>
  ),
});

const STATUS_OPTS: Array<{ v: StatusCobranca | "todos"; label: string }> = [
  { v: "todos", label: "Todos" },
  { v: "pago", label: "Pagas" },
  { v: "pendente", label: "Pendentes" },
  { v: "vencido", label: "Vencidas" },
  { v: "cancelada", label: "Canceladas" },
  { v: "isenta", label: "Isentas" },
  { v: "parcial", label: "Parciais" },
];

const TYPE_OPTS: Array<{ v: TipoLancamento | "todos"; label: string }> = [
  { v: "todos", label: "Todos os tipos" },
  { v: "recorrente", label: "Recorrentes" },
  { v: "avulsa", label: "Avulsas" },
];

function statusBadge(status: StatusCobranca) {
  const map = {
    pago: "bg-success/15 text-success border-success/30",
    pendente: "bg-warning/15 text-warning border-warning/30",
    vencido: "bg-destructive/15 text-destructive border-destructive/30",
    cancelada: "bg-muted text-muted-foreground border-border",
    isenta: "bg-primary/10 text-primary border-primary/20",
    parcial: "bg-amber-500/10 text-amber-200 border-amber-500/30",
  } as const;
  const label = {
    pago: "Paga",
    pendente: "Pendente",
    vencido: "Vencida",
    cancelada: "Cancelada",
    isenta: "Isenta",
    parcial: "Parcial",
  }[status];
  return (
    <span
      className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", map[status])}
    >
      {label}
    </span>
  );
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function FinanceiroPage() {
  const { isSelfService } = useAuth();

  if (isSelfService) {
    return <FinanceiroSelfServicePage />;
  }

  return <FinanceiroAdminPage />;
}

function FinanceiroAdminPage() {
  const transacoes = useTransacoes();
  const recorrencias = useRecorrenciasFinanceiras();
  const financeiroStatus = useFinanceiroStatus();

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusCobranca | "todos">("todos");
  const [filtroMes, setFiltroMes] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [filtroTipo, setFiltroTipo] = useState<TipoLancamento | "todos">("todos");

  const [openNova, setOpenNova] = useState(false);
  const [editing, setEditing] = useState<Transacao | null>(null);
  const [baixaItens, setBaixaItens] = useState<Transacao[] | null>(null);
  const [toDelete, setToDelete] = useState<Transacao | null>(null);
  const [toCancel, setToCancel] = useState<Transacao | null>(null);
  const [confirmLote, setConfirmLote] = useState(false);

  const handleGenerateMensalidades = useCallback(async (showToast = true) => {
    try {
      const result = await financeiroStore.processarRecorrenciaAutomatica();
      if (showToast) {
        toast.success(
          result.createdCount > 0
            ? `${result.createdCount} mensalidade(s) gerada(s) e ${result.skippedCount} ignorada(s).`
            : `Nenhuma nova mensalidade foi criada. ${result.skippedCount} registro(s) foram ignorados.`,
        );
      }
    } catch (error) {
      if (showToast) {
        toast.error(
          error instanceof Error ? error.message : "Nao foi possivel gerar mensalidades.",
        );
      }
    }
  }, []);

  useEffect(() => {
    if (!financeiroStatus.initialized || financeiroStatus.error) return;
    void handleGenerateMensalidades(false);
  }, [financeiroStatus.error, financeiroStatus.initialized, handleGenerateMensalidades]);

  const meses = useMemo(() => listMonths(transacoes), [transacoes]);

  const doMes = useMemo(
    () => transacoes.filter((transacao) => transacao.vencimento.slice(0, 7) === filtroMes),
    [transacoes, filtroMes],
  );

  const filtrados = useMemo(() => {
    const query = busca.trim().toLowerCase();
    return doMes.filter((transacao) => {
      const status = calcStatus(transacao);
      const tipo = transacao.tipoCobranca ?? "avulsa";

      if (filtroStatus !== "todos" && status !== filtroStatus) return false;
      if (filtroTipo !== "todos" && tipo !== filtroTipo) return false;
      if (!query) return true;

      return [
        transacao.alunoNome,
        transacao.responsavelFinanceiro,
        transacao.planoNome,
        transacao.descricao,
        transacao.unidade,
        transacao.modalidade,
        transacao.turma,
        transacao.competencia,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [busca, doMes, filtroStatus, filtroTipo]);

  const totais = useMemo(() => {
    let recebido = 0;
    let aReceber = 0;
    let vencido = 0;
    let recorrentes = 0;
    let pausadas = 0;
    let inadimplentes = 0;

    const alunosInadimplentes = new Set<string>();

    for (const transacao of doMes) {
      const status = calcStatus(transacao);
      const valorAtual = getValorAtualizado(transacao);

      if ((transacao.tipoCobranca ?? "avulsa") === "recorrente") recorrentes += 1;
      if (status === "pago") recebido += transacao.valor;
      else if (status === "vencido") {
        vencido += valorAtual;
        alunosInadimplentes.add(transacao.alunoId);
      } else if (status === "pendente" || status === "parcial") {
        aReceber += valorAtual;
      }
    }

    for (const recorrencia of recorrencias) {
      if (!recorrencia.recorrenciaAtiva) pausadas += 1;
    }

    inadimplentes = alunosInadimplentes.size;

    return {
      recebido,
      aReceber,
      vencido,
      recorrentes,
      pausadas,
      inadimplentes,
      total: doMes.length,
    };
  }, [doMes, recorrencias]);

  const pendentesEVencidos = useMemo(
    () =>
      doMes.filter((transacao) => {
        const status = calcStatus(transacao);
        return status === "pendente" || status === "vencido" || status === "parcial";
      }),
    [doMes],
  );

  function handleDelete() {
    if (!toDelete) return;
    financeiroStore.remove(toDelete.id);
    toast.success("Cobranca excluida.");
    setToDelete(null);
  }

  function handleCancelCharge() {
    if (!toCancel) return;
    financeiroStore.cancelar(toCancel.id);
    toast.success("Cobranca futura cancelada.");
    setToCancel(null);
  }

  function handlePauseOrResume(transacao: Transacao) {
    const recorrencia = getRecorrenciaAluno(transacao.alunoId);
    if (!recorrencia) {
      toast.error("Nao ha recorrencia configurada para este aluno.");
      return;
    }

    if (recorrencia.recorrenciaAtiva) {
      financeiroStore.pausarRecorrencia(transacao.alunoId);
      financeiroStore.cancelarFuturas(transacao.alunoId);
      toast.success("Recorrencia pausada e futuras cobrancas canceladas.");
      return;
    }

    financeiroStore.reativarRecorrencia(transacao.alunoId);
    toast.success("Recorrencia reativada. Gere as mensalidades para refletir o ciclo atual.");
  }

  function handleQuickAction(action: "link" | "segunda-via" | "reenviar", transacao: Transacao) {
    const messages = {
      link: `Estrutura pronta para gateway: cobranca ${transacao.id} aguardando integracao de link.`,
      "segunda-via": `Segunda via preparada para a cobranca de ${transacao.alunoNome}.`,
      reenviar: `Cobranca reenviada para ${transacao.email || transacao.telefoneWhatsapp || "o contato do responsavel"}.`,
    };
    toast.info(messages[action]);
  }

  return (
    <AppShell title="Financeiro">
      <ResourceSyncBanner
        status={financeiroStatus}
        resourceLabel="o financeiro"
        hasData={transacoes.length > 0}
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard
          label="Recebido no mes"
          value={formatBRL(totais.recebido)}
          hint="Pagamentos confirmados"
          icon={TrendingUp}
          tone="success"
        />
        <KpiCard
          label="A receber"
          value={formatBRL(totais.aReceber)}
          hint="Pendentes e parciais"
          icon={Clock}
          tone="warning"
        />
        <KpiCard
          label="Vencido"
          value={formatBRL(totais.vencido)}
          hint={`${totais.inadimplentes} aluno(s) inadimplentes`}
          icon={AlertTriangle}
          tone="destructive"
        />
        <KpiCard
          label="Recorrencias"
          value={String(recorrencias.filter((item) => item.recorrenciaAtiva).length)}
          hint={`${totais.recorrentes} cobrancas recorrentes no mes`}
          icon={CircleDollarSign}
          tone="primary"
        />
        <KpiCard
          label="Pausadas"
          value={String(totais.pausadas)}
          hint="Recorrencias sem emissao automatica"
          icon={PauseCircle}
          tone="warning"
        />
        <KpiCard
          label="Lancamentos"
          value={String(totais.total)}
          hint={monthLabel(filtroMes)}
          icon={ReceiptText}
          tone="primary"
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por aluno, responsavel, plano, unidade, modalidade ou competencia..."
            className="w-full rounded-lg border border-input bg-input/40 py-2 pl-9 pr-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent/30"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={filtroMes}
          onChange={(event) => setFiltroMes(event.target.value)}
          className="rounded-lg border border-input bg-input/40 px-3 py-2 text-sm capitalize outline-none focus:border-primary"
        >
          {meses.map((mes) => (
            <option key={mes} value={mes}>
              {monthLabel(mes)}
            </option>
          ))}
        </select>

        <select
          value={filtroStatus}
          onChange={(event) => setFiltroStatus(event.target.value as typeof filtroStatus)}
          className="rounded-lg border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {STATUS_OPTS.map((option) => (
            <option key={option.v} value={option.v}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={filtroTipo}
          onChange={(event) => setFiltroTipo(event.target.value as typeof filtroTipo)}
          className="rounded-lg border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {TYPE_OPTS.map((option) => (
            <option key={option.v} value={option.v}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => void handleGenerateMensalidades()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
        >
          <Zap className="h-4 w-4" />
          Gerar mensalidades
        </button>

        <button
          onClick={() => setConfirmLote(true)}
          disabled={pendentesEVencidos.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-success/40 bg-success/10 px-4 py-2 text-sm font-semibold text-success transition-colors hover:bg-success/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCircle2 className="h-4 w-4" />
          Baixa em lote
        </button>

        <button
          onClick={() => {
            setEditing(null);
            setOpenNova(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          <Plus className="h-4 w-4" />
          Nova cobranca
        </button>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        {recorrencias.slice(0, 3).map((recorrencia) => (
          <div key={recorrencia.alunoId} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{recorrencia.alunoNome}</div>
                <div className="text-xs text-muted-foreground">{recorrencia.planoNome}</div>
              </div>
              {recorrencia.recorrenciaAtiva ? statusBadge("pendente") : statusBadge("cancelada")}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <InfoPill label="Periodicidade" value={recorrencia.periodicidade} />
              <InfoPill label="Vencimento" value={`Dia ${recorrencia.diaVencimento}`} />
              <InfoPill label="Valor base" value={formatBRL(recorrencia.valorPlano)} />
              <InfoPill
                label="Proxima"
                value={
                  recorrencia.proximaCobranca
                    ? formatDate(recorrencia.proximaCobranca)
                    : "A definir"
                }
              />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-card xl:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Aluno / responsavel</th>
              <th className="px-4 py-3">Plano / competencia</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Valores</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtrados.map((transacao) => {
              const status = calcStatus(transacao);
              const recorrencia = getRecorrenciaAluno(transacao.alunoId);
              const valorAtualizado = getValorAtualizado(transacao);
              return (
                <tr key={transacao.id} className="align-top hover:bg-accent/5">
                  <td className="px-4 py-3">
                    <div className="font-medium">{transacao.alunoNome}</div>
                    <div className="text-xs text-muted-foreground">
                      {transacao.responsavelFinanceiro || "Responsavel nao informado"}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {[transacao.unidade, transacao.modalidade, transacao.turma]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{transacao.planoNome || "Avulsa"}</div>
                    <div className="text-xs text-muted-foreground">
                      {transacao.competencia
                        ? transacao.competencia.replace(":", " · ")
                        : "Sem competencia"}
                    </div>
                    <div className="mt-1 flex gap-2">
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        {transacao.tipoCobranca === "recorrente" ? "Recorrente" : "Avulsa"}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        {transacao.origem === "automatica" ? "Automatica" : "Manual"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{formatDate(transacao.vencimento)}</div>
                    <div className="text-xs text-muted-foreground">
                      Gerada em{" "}
                      {formatDate((transacao.dataGeracao || transacao.vencimento).slice(0, 10))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{formatBRL(valorAtualizado)}</div>
                    <div className="text-xs text-muted-foreground">
                      Original {formatBRL(transacao.valorOriginal ?? transacao.valor)}
                    </div>
                    {transacao.descontoValor || transacao.bolsaValor ? (
                      <div className="text-xs text-muted-foreground">
                        Descontos{" "}
                        {formatBRL((transacao.descontoValor ?? 0) + (transacao.bolsaValor ?? 0))}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {statusBadge(status)}
                    {recorrencia && (
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        {recorrencia.recorrenciaAtiva ? "Recorrencia ativa" : "Recorrencia pausada"}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {transacao.pagoEm ? (
                      <>
                        <div>{formatDate(transacao.pagoEm)}</div>
                        <div className="capitalize">{transacao.formaPagamento}</div>
                      </>
                    ) : (
                      "Em aberto"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      {status !== "pago" && status !== "cancelada" ? (
                        <button
                          onClick={() => setBaixaItens([transacao])}
                          className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2.5 py-1.5 text-xs font-medium text-success hover:bg-success/20"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Baixar
                        </button>
                      ) : status === "pago" ? (
                        <button
                          onClick={() => financeiroStore.reabrir(transacao.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/10"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                        </button>
                      ) : null}

                      <button
                        onClick={() => {
                          setEditing(transacao);
                          setOpenNova(true);
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10"
                        title="Editar cobranca"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleQuickAction("link", transacao)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10"
                        title="Emitir link de pagamento"
                      >
                        <Link2 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleQuickAction("segunda-via", transacao)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10"
                        title="Gerar segunda via"
                      >
                        <ReceiptText className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleQuickAction("reenviar", transacao)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10"
                        title="Reenviar cobranca"
                      >
                        <Send className="h-4 w-4" />
                      </button>

                      {(transacao.tipoCobranca ?? "avulsa") === "recorrente" && (
                        <button
                          onClick={() => handlePauseOrResume(transacao)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10"
                          title={
                            recorrencia?.recorrenciaAtiva
                              ? "Pausar recorrencia"
                              : "Reativar recorrencia"
                          }
                        >
                          {recorrencia?.recorrenciaAtiva ? (
                            <PauseCircle className="h-4 w-4" />
                          ) : (
                            <PlayCircle className="h-4 w-4" />
                          )}
                        </button>
                      )}

                      {(transacao.tipoCobranca ?? "avulsa") === "recorrente" &&
                        status !== "pago" && (
                          <button
                            onClick={() => setToCancel(transacao)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10"
                            title="Cancelar cobranca futura"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}

                      <button
                        onClick={() => setToDelete(transacao)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        title="Excluir cobranca"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhuma cobranca encontrada neste filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 xl:hidden">
        {filtrados.map((transacao) => {
          const status = calcStatus(transacao);
          const recorrencia = getRecorrenciaAluno(transacao.alunoId);
          return (
            <div key={transacao.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{transacao.alunoNome}</div>
                  <div className="text-xs text-muted-foreground">
                    {transacao.responsavelFinanceiro || "Responsavel nao informado"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {transacao.planoNome || transacao.descricao}
                  </div>
                </div>
                {statusBadge(status)}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <InfoPill label="Competencia" value={transacao.competencia || "Sem competencia"} />
                <InfoPill label="Vencimento" value={formatDate(transacao.vencimento)} />
                <InfoPill label="Valor final" value={formatBRL(getValorAtualizado(transacao))} />
                <InfoPill
                  label="Recorrencia"
                  value={
                    recorrencia?.recorrenciaAtiva
                      ? "Ativa"
                      : transacao.tipoCobranca === "recorrente"
                        ? "Pausada"
                        : "Avulsa"
                  }
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                {status !== "pago" && status !== "cancelada" ? (
                  <button
                    onClick={() => setBaixaItens([transacao])}
                    className="flex items-center gap-2 rounded-lg bg-success/15 px-3 py-2 text-sm font-medium text-success hover:bg-success/25"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Baixar
                  </button>
                ) : null}
                <button
                  onClick={() => {
                    setEditing(transacao);
                    setOpenNova(true);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent/10"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </button>
                {(transacao.tipoCobranca ?? "avulsa") === "recorrente" && (
                  <button
                    onClick={() => handlePauseOrResume(transacao)}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent/10"
                  >
                    {recorrencia?.recorrenciaAtiva ? (
                      <>
                        <PauseCircle className="h-4 w-4" /> Pausar
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4" /> Reativar
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filtrados.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
            Nenhuma cobranca encontrada neste filtro.
          </div>
        )}
      </div>

      <CobrancaDialog
        open={openNova}
        onOpenChange={(open) => {
          setOpenNova(open);
          if (!open) setEditing(null);
        }}
        transacao={editing}
      />
      <BaixaDialog
        open={!!baixaItens}
        onOpenChange={(open) => !open && setBaixaItens(null)}
        transacoes={baixaItens ?? []}
      />

      <AlertDialog open={confirmLote} onOpenChange={setConfirmLote}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Baixa em lote</AlertDialogTitle>
            <AlertDialogDescription>
              Voce vai marcar como pagas <strong>{pendentesEVencidos.length} cobrancas</strong> de{" "}
              <strong>{monthLabel(filtroMes)}</strong>, totalizando{" "}
              <strong>
                {formatBRL(
                  pendentesEVencidos.reduce(
                    (accumulator, transacao) => accumulator + getValorAtualizado(transacao),
                    0,
                  ),
                )}
              </strong>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLote(false);
                setBaixaItens(pendentesEVencidos);
              }}
              className="bg-success text-primary-foreground hover:bg-success/90"
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toCancel} onOpenChange={(open) => !open && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar cobranca futura?</AlertDialogTitle>
            <AlertDialogDescription>
              A cobranca selecionada sera mantida no historico, mas deixara de ficar ativa para
              cobranca e acompanhamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelCharge}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancelar cobranca
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cobranca?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao remove o lancamento do financeiro. Use cancelamento se quiser preservar o
              historico sem apagar o registro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function FinanceiroSelfServicePage() {
  const portalAluno = usePortalAluno(true);
  const portalFinanceiro = usePortalFinanceiro(true);

  const transacoes = portalFinanceiro.data;
  const totais = useMemo(() => {
    let aberto = 0;
    let pago = 0;
    let vencido = 0;

    for (const transacao of transacoes) {
      const status = calcStatus(transacao);
      const valorAtual = getValorAtualizado(transacao);

      if (status === "pago") {
        pago += transacao.valor;
      } else if (status === "vencido") {
        vencido += valorAtual;
      } else if (status === "pendente" || status === "parcial") {
        aberto += valorAtual;
      }
    }

    return {
      aberto,
      pago,
      vencido,
    };
  }, [transacoes]);

  const proxima = useMemo(
    () =>
      [...transacoes]
        .filter((transacao) => {
          const status = calcStatus(transacao);
          return status === "pendente" || status === "parcial" || status === "vencido";
        })
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0] ?? null,
    [transacoes],
  );

  if (portalAluno.loading || portalFinanceiro.loading) {
    return (
      <AppShell title="Meu Financeiro">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  if (portalAluno.error || portalFinanceiro.error) {
    return (
      <AppShell title="Meu Financeiro">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          {portalAluno.error || portalFinanceiro.error}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Meu Financeiro">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Financeiro do aluno</h2>
        <p className="text-sm text-muted-foreground">
          Acompanhe mensalidades, status de pagamento e a proxima cobranca prevista.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Em aberto"
          value={formatBRL(totais.aberto)}
          hint="Parcelas pendentes e parciais"
          icon={Clock}
          tone="warning"
        />
        <KpiCard
          label="Pago"
          value={formatBRL(totais.pago)}
          hint="Historico de pagamentos"
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Vencido"
          value={formatBRL(totais.vencido)}
          hint="Valores em atraso"
          icon={AlertTriangle}
          tone={totais.vencido > 0 ? "destructive" : "success"}
        />
        <KpiCard
          label="Proxima cobranca"
          value={proxima ? formatDate(proxima.vencimento) : "Sem pendencias"}
          hint={portalAluno.data?.plano || "Plano nao informado"}
          icon={CircleDollarSign}
          tone="primary"
        />
      </div>

      <div className="space-y-3">
        {transacoes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
            Nenhuma cobranca encontrada para este aluno.
          </div>
        ) : (
          transacoes
            .slice()
            .sort((a, b) => b.vencimento.localeCompare(a.vencimento))
            .map((transacao) => {
              const status = calcStatus(transacao);
              return (
                <div key={transacao.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-semibold">{transacao.descricao}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {transacao.planoNome || portalAluno.data?.plano || "Plano nao informado"}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Competencia: {transacao.competencia || transacao.vencimento.slice(0, 7)}
                      </div>
                    </div>
                    {statusBadge(status)}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoPill label="Vencimento" value={formatDate(transacao.vencimento)} />
                    <InfoPill
                      label="Valor final"
                      value={formatBRL(getValorAtualizado(transacao))}
                    />
                    <InfoPill
                      label="Pagamento"
                      value={
                        transacao.pagoEm
                          ? `${formatDate(transacao.pagoEm)}${transacao.formaPagamento ? ` - ${transacao.formaPagamento}` : ""}`
                          : "Em aberto"
                      }
                    />
                    <InfoPill
                      label="Origem"
                      value={
                        transacao.tipoCobranca === "recorrente"
                          ? "Recorrencia automatica"
                          : "Lancamento avulso"
                      }
                    />
                  </div>
                </div>
              );
            })
        )}
      </div>
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof TrendingUp;
  tone: "primary" | "success" | "warning" | "destructive";
}) {
  const toneCls = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-xl font-bold">{value}</div>
        </div>
        <div className={cn("rounded-lg p-2", toneCls)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
