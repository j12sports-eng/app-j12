import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserRoundSearch,
} from "lucide-react";
import { toast } from "sonner";

import { formatApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import {
  FinancialObligationCard,
  canCancelFinancialObligation,
  canMarkFinancialObligationOverdue,
  canMarkFinancialObligationPaid,
} from "../components/FinancialObligationCard";
import { FinancialStatusBadge } from "../components/FinancialStatusBadge";
import { useEnrollmentFinancialObligations } from "../hooks/useEnrollmentFinancialObligations";
import { useFinancialObligationActions } from "../hooks/useFinancialObligationActions";
import { useFinancialStudentScopeSearch } from "../hooks/useFinancialStudentScopeSearch";
import { useStudentFinancialSummary } from "../hooks/useStudentFinancialSummary";

import type {
  EnrollmentFinancialObligation,
  FinancialStudentScope,
} from "../types/financial.types";

type ActionMode = "mark-paid" | "cancel" | "mark-overdue";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

function nowForDateTimeInput() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);

  return localDate.toISOString().slice(0, 16);
}

function toBackendDateTime(value: string) {
  const normalized = value.trim();

  if (!normalized) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized.replace("T", " ")}:00`;
  }

  return normalized.replace("T", " ");
}

function money(value: number | null | undefined) {
  return currencyFormatter.format(Number(value || 0));
}

function normalizeStatus(status: string | null | undefined) {
  return String(status || "PENDING")
    .trim()
    .toUpperCase();
}

function scopeSecondaryText(scope: FinancialStudentScope) {
  return [
    scope.studentCpf ? `CPF ${scope.studentCpf}` : null,
    scope.studentEmail || null,
    scope.profileStatus ? `perfil ${scope.profileStatus}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function pickActor(user: unknown) {
  if (!user || typeof user !== "object") return "admin";

  const source = user as {
    email?: unknown;
    id?: unknown;
    nome?: unknown;
    name?: unknown;
  };

  return String(source.email || source.nome || source.name || source.id || "admin").trim();
}

export function FinancialAdminEnrollmentPanel() {
  const { user } = useAuth();
  const [enrollmentIdInput, setEnrollmentIdInput] = useState("");
  const [studentSearchInput, setStudentSearchInput] = useState("");
  const [studentPersonIdInput, setStudentPersonIdInput] = useState("");
  const [studentProfileIdInput, setStudentProfileIdInput] = useState("");
  const [submittedEnrollmentId, setSubmittedEnrollmentId] = useState<string | null>(null);
  const [submittedStudentSearch, setSubmittedStudentSearch] = useState<string | null>(null);
  const [submittedStudentPersonId, setSubmittedStudentPersonId] = useState<string | null>(null);
  const [submittedStudentProfileId, setSubmittedStudentProfileId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<{
    mode: ActionMode;
    obligation: EnrollmentFinancialObligation;
  } | null>(null);
  const [actionDateTime, setActionDateTime] = useState(nowForDateTimeInput);
  const [paymentReference, setPaymentReference] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const obligationsQuery = useEnrollmentFinancialObligations({
    enabled: Boolean(submittedEnrollmentId),
    enrollmentId: submittedEnrollmentId,
    limit: 50,
  });
  const summaryQuery = useStudentFinancialSummary({
    enabled: Boolean(submittedStudentPersonId && submittedStudentProfileId),
    limit: 100,
    studentPersonId: submittedStudentPersonId,
    studentProfileId: submittedStudentProfileId,
  });
  const scopeSearchQuery = useFinancialStudentScopeSearch({
    enabled: Boolean(submittedStudentSearch),
    limit: 8,
    query: submittedStudentSearch,
  });
  const actions = useFinancialObligationActions({
    enrollmentId: submittedEnrollmentId,
    studentPersonId: submittedStudentPersonId,
    studentProfileId: submittedStudentProfileId,
  });

  const loadedObligations = obligationsQuery.data?.obligations;
  const obligations = useMemo(() => loadedObligations || [], [loadedObligations]);
  const studentScopeResults = scopeSearchQuery.data?.scopes || [];
  const summary = summaryQuery.data?.summary;
  const actor = pickActor(user);
  const canSubmitAction = Boolean(selectedAction?.obligation.id) && !actions.working;

  const obligationStatusCounts = useMemo(() => {
    return obligations.reduce<Record<string, number>>((acc, obligation) => {
      const status = normalizeStatus(obligation.status);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }, [obligations]);

  function handleEnrollmentSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const enrollmentId = enrollmentIdInput.trim();

    if (!enrollmentId) {
      toast.error("Informe o id da matricula.");
      return;
    }

    setSubmittedEnrollmentId(enrollmentId);
  }

  function handleStudentSummarySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const studentPersonId = studentPersonIdInput.trim();
    const studentProfileId = studentProfileIdInput.trim();

    if (!studentPersonId || !studentProfileId) {
      toast.error("Informe pessoa e perfil do aluno.");
      return;
    }

    setSubmittedStudentPersonId(studentPersonId);
    setSubmittedStudentProfileId(studentProfileId);
  }

  function handleStudentScopeSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = studentSearchInput.trim();

    if (query.length < 2) {
      toast.error("Informe ao menos 2 caracteres para buscar aluno.");
      return;
    }

    setSubmittedStudentSearch(query);
  }

  function selectStudentScope(scope: FinancialStudentScope) {
    const studentPersonId = String(scope.studentPersonId || "").trim();
    const studentProfileId = String(scope.studentProfileId || "").trim();

    if (!studentPersonId || !studentProfileId) {
      toast.error("Resultado sem escopo valido.");
      return;
    }

    setStudentPersonIdInput(studentPersonId);
    setStudentProfileIdInput(studentProfileId);
    setSubmittedStudentPersonId(studentPersonId);
    setSubmittedStudentProfileId(studentProfileId);
  }

  function openAction(mode: ActionMode, obligation: EnrollmentFinancialObligation) {
    if (!obligation.id) {
      toast.error("Obrigacao sem id valido.");
      return;
    }

    const allowed =
      (mode === "mark-paid" && canMarkFinancialObligationPaid(obligation)) ||
      (mode === "cancel" && canCancelFinancialObligation(obligation)) ||
      (mode === "mark-overdue" && canMarkFinancialObligationOverdue(obligation));

    if (!allowed) {
      toast.error("Transicao bloqueada para o status atual.");
      return;
    }

    setSelectedAction({ mode, obligation });
    setActionDateTime(nowForDateTimeInput());
    setPaymentReference("");
    setCancelReason("");
  }

  async function submitSelectedAction() {
    if (!selectedAction?.obligation.id) {
      toast.error("Selecione uma obrigacao financeira.");
      return;
    }

    const occurredAt = toBackendDateTime(actionDateTime);

    if (!occurredAt) {
      toast.error("Informe data e horario da acao.");
      return;
    }

    try {
      if (selectedAction.mode === "mark-paid") {
        await actions.markPaid.mutateAsync({
          obligationId: selectedAction.obligation.id,
          paidAt: occurredAt,
          paidBy: actor,
          paymentReference: paymentReference.trim() || null,
        });
        toast.success("Obrigacao marcada como paga.");
      } else if (selectedAction.mode === "cancel") {
        const reason = cancelReason.trim();

        if (!reason) {
          toast.error("Informe o motivo do cancelamento.");
          return;
        }

        await actions.cancel.mutateAsync({
          cancelledAt: occurredAt,
          cancelledBy: actor,
          obligationId: selectedAction.obligation.id,
          reason,
        });
        toast.success("Obrigacao cancelada.");
      } else {
        await actions.markOverdue.mutateAsync({
          checkedAt: occurredAt,
          obligationId: selectedAction.obligation.id,
        });
        toast.success("Obrigacao marcada como vencida.");
      }

      setSelectedAction(null);
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Nao foi possivel executar a acao financeira."));
    }
  }

  return (
    <section className="j12-surface p-5 md:p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Financeiro de matriculas
          </div>
          <h2 className="mt-3 text-2xl font-black text-white md:text-3xl">
            Obrigacoes financeiras originadas por matricula
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Consulta operacional por matricula ou escopo de aluno, usando a API administrativa
            protegida do Financeiro.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" />
            <div>
              <p className="font-bold text-white">Acoes guardadas</p>
              <p className="mt-1 leading-5">Sem gateway, boleto, Pix ou baixa externa.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <form
            onSubmit={handleEnrollmentSearch}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-300">Matricula</span>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  value={enrollmentIdInput}
                  onChange={(event) => setEnrollmentIdInput(event.target.value)}
                  className="j12-field h-12 w-full px-4"
                  placeholder="ID da matricula"
                />
                <button
                  type="submit"
                  disabled={obligationsQuery.isFetching}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {obligationsQuery.isFetching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Consultar
                </button>
              </div>
            </label>
          </form>

          <form
            onSubmit={handleStudentScopeSearch}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
              <UserRoundSearch className="h-4 w-4 text-primary" />
              Buscar aluno
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={studentSearchInput}
                onChange={(event) => setStudentSearchInput(event.target.value)}
                className="j12-field h-12 w-full px-4"
                placeholder="Nome, CPF, e-mail ou ID"
              />
              <button
                type="submit"
                disabled={scopeSearchQuery.isFetching}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {scopeSearchQuery.isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </button>
            </div>

            {scopeSearchQuery.error && (
              <div className="mt-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {formatApiErrorMessage(scopeSearchQuery.error, "Nao foi possivel buscar alunos.")}
              </div>
            )}

            {!scopeSearchQuery.isFetching &&
              submittedStudentSearch &&
              studentScopeResults.length === 0 &&
              !scopeSearchQuery.error && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  Nenhum aluno encontrado.
                </div>
              )}

            {studentScopeResults.length > 0 && (
              <div className="mt-3 grid gap-2">
                {studentScopeResults.map((scope) => (
                  <button
                    key={`${scope.studentPersonId || "person"}-${scope.studentProfileId || "profile"}`}
                    type="button"
                    onClick={() => selectStudentScope(scope)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">
                          {scope.studentName || scope.studentPersonId || "Aluno"}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {scopeSecondaryText(scope) || "Escopo de aluno"}
                        </p>
                      </div>
                      <FinancialStatusBadge status={scope.status || "NONE"} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </form>

          <form
            onSubmit={handleStudentSummarySearch}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
              <UserRoundSearch className="h-4 w-4 text-primary" />
              Resumo por aluno
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">Pessoa</span>
                <input
                  value={studentPersonIdInput}
                  onChange={(event) => setStudentPersonIdInput(event.target.value)}
                  className="j12-field h-12 w-full px-4"
                  placeholder="studentPersonId"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">Perfil</span>
                <input
                  value={studentProfileIdInput}
                  onChange={(event) => setStudentProfileIdInput(event.target.value)}
                  className="j12-field h-12 w-full px-4"
                  placeholder="studentProfileId"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={summaryQuery.isFetching}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {summaryQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Carregar resumo
            </button>
          </form>

          <div className="grid grid-cols-2 gap-2">
            <FinancialStatusBadge status="PENDING" />
            <FinancialStatusBadge status="PREPARED" />
            <FinancialStatusBadge status="PAID" />
            <FinancialStatusBadge status="OVERDUE" />
            <FinancialStatusBadge status="CANCELLED" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryTile
              icon={Banknote}
              label="Total"
              value={summary ? money(summary.amountTotal) : money(0)}
            />
            <SummaryTile
              icon={Clock3}
              label="Aberto"
              tone="warning"
              value={summary ? money(summary.amountOpen) : money(0)}
            />
            <SummaryTile
              icon={CheckCircle2}
              label="Pago"
              tone="success"
              value={summary ? money(summary.amountPaid) : money(0)}
            />
            <SummaryTile
              icon={AlertTriangle}
              label="Vencido"
              tone="danger"
              value={summary ? money(summary.amountOverdue) : money(0)}
            />
          </div>

          {(obligationsQuery.error || summaryQuery.error) && (
            <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {formatApiErrorMessage(
                obligationsQuery.error || summaryQuery.error,
                "Nao foi possivel carregar o financeiro de matriculas.",
              )}
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Obrigacoes da matricula</h3>
                <p className="text-sm text-slate-400">
                  {submittedEnrollmentId
                    ? `${obligations.length} registro(s) para ${submittedEnrollmentId}`
                    : "Informe uma matricula para consultar."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["PREPARED", "PENDING", "PAID", "OVERDUE", "CANCELLED"].map((status) => (
                  <span
                    key={status}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300"
                  >
                    {status}: {obligationStatusCounts[status] || 0}
                  </span>
                ))}
              </div>
            </div>

            {obligationsQuery.isFetching && (
              <div className="flex min-h-40 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
                Carregando obrigacoes
              </div>
            )}

            {!obligationsQuery.isFetching && obligations.length === 0 && (
              <div className="j12-empty-state p-8 text-center">
                <p className="font-bold text-white">Nenhuma obrigacao carregada.</p>
                <p className="mt-2 text-sm text-slate-400">
                  A consulta nao cria cobranca, pagamento ou integracao externa.
                </p>
              </div>
            )}

            {!obligationsQuery.isFetching && obligations.length > 0 && (
              <div className="grid gap-3">
                {obligations.map((obligation) => (
                  <FinancialObligationCard
                    key={obligation.id || `${obligation.enrollmentId}-${obligation.obligationType}`}
                    disabled={actions.working}
                    obligation={obligation}
                    onCancel={(item) => openAction("cancel", item)}
                    onMarkOverdue={(item) => openAction("mark-overdue", item)}
                    onMarkPaid={(item) => openAction("mark-paid", item)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedAction && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur sm:items-center">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl md:p-6">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Acao financeira interna
              </p>
              <h3 className="mt-2 text-2xl font-black text-white">
                {selectedAction.mode === "mark-paid"
                  ? "Marcar como paga"
                  : selectedAction.mode === "cancel"
                    ? "Cancelar obrigacao"
                    : "Marcar como vencida"}
              </h3>
              <p className="mt-2 break-all text-sm text-slate-400">
                {selectedAction.obligation.id}
              </p>
            </div>

            <div className="grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">
                  Data e horario
                </span>
                <input
                  type="datetime-local"
                  value={actionDateTime}
                  onChange={(event) => setActionDateTime(event.target.value)}
                  className="j12-field h-12 w-full px-4"
                />
              </label>

              {selectedAction.mode === "mark-paid" && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">
                    Referencia interna
                  </span>
                  <input
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    className="j12-field h-12 w-full px-4"
                    placeholder="Comprovante interno, recibo ou observacao"
                  />
                </label>
              )}

              {selectedAction.mode === "cancel" && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">Motivo</span>
                  <textarea
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    className="j12-field min-h-24 w-full px-4 py-3"
                    placeholder="Motivo administrativo do cancelamento"
                  />
                </label>
              )}

              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                Esta acao altera apenas o status interno da obrigacao financeira de matricula.
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSelectedAction(null)}
                className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-white transition hover:bg-white/10"
              >
                Fechar
              </button>
              <button
                type="button"
                disabled={!canSubmitAction}
                onClick={() => void submitSelectedAction()}
                className={cn(
                  "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
                  selectedAction.mode === "cancel"
                    ? "bg-red-500 text-white hover:bg-red-400"
                    : "bg-primary text-primary-foreground hover:brightness-110",
                )}
              >
                {actions.working && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  tone = "primary",
  value,
}: {
  icon: typeof Banknote;
  label: string;
  tone?: "primary" | "success" | "warning" | "danger";
  value: string;
}) {
  const toneClass = {
    danger: "border-red-400/20 bg-red-500/10 text-red-100",
    primary: "border-primary/20 bg-primary/10 text-primary",
    success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    warning: "border-amber-400/20 bg-amber-500/10 text-amber-100",
  }[tone];

  return (
    <div className={cn("rounded-2xl border p-4", toneClass)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em]">{label}</p>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-xl font-black text-white">{value}</p>
    </div>
  );
}
