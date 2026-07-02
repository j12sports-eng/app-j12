import { Ban, CheckCircle2, Clock3 } from "lucide-react";

import { cn } from "@/lib/utils";

import { FinancialStatusBadge } from "./FinancialStatusBadge";

import type { EnrollmentFinancialObligation } from "../types/financial.types";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

function normalizeStatus(status: string | null | undefined) {
  return String(status || "PENDING")
    .trim()
    .toUpperCase();
}

function formatMoney(value: number | null | undefined, currency?: string | null) {
  const amount = Number(value || 0);

  if (currency && currency !== "BRL") {
    return `${currency} ${amount.toFixed(2)}`;
  }

  return currencyFormatter.format(amount);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("pt-BR");
}

export function canMarkFinancialObligationPaid(obligation: EnrollmentFinancialObligation | null) {
  const status = normalizeStatus(obligation?.status);

  return status === "PREPARED" || status === "PENDING" || status === "OVERDUE";
}

export function canCancelFinancialObligation(obligation: EnrollmentFinancialObligation | null) {
  const status = normalizeStatus(obligation?.status);

  return status === "PREPARED" || status === "PENDING" || status === "OVERDUE";
}

export function canMarkFinancialObligationOverdue(
  obligation: EnrollmentFinancialObligation | null,
) {
  const status = normalizeStatus(obligation?.status);

  return status === "PREPARED" || status === "PENDING";
}

export function FinancialObligationCard({
  disabled,
  obligation,
  onCancel,
  onMarkOverdue,
  onMarkPaid,
}: {
  disabled?: boolean;
  obligation: EnrollmentFinancialObligation;
  onCancel?: (obligation: EnrollmentFinancialObligation) => void;
  onMarkOverdue?: (obligation: EnrollmentFinancialObligation) => void;
  onMarkPaid?: (obligation: EnrollmentFinancialObligation) => void;
}) {
  const canMarkPaid = canMarkFinancialObligationPaid(obligation);
  const canCancel = canCancelFinancialObligation(obligation);
  const canMarkOverdue = canMarkFinancialObligationOverdue(obligation);

  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FinancialStatusBadge status={obligation.status} />
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
              {obligation.obligationType || "INITIAL"}
            </span>
          </div>
          <h3 className="mt-3 break-all text-base font-bold text-white">
            {obligation.id || "Obrigacao sem id"}
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Matricula {obligation.enrollmentId || "-"} | Origem {obligation.source || "-"}
          </p>
        </div>

        <div className="text-left md:text-right">
          <p className="text-2xl font-black text-white">
            {formatMoney(obligation.amount, obligation.currency)}
          </p>
          <p className="mt-1 text-sm text-slate-400">Vence em {formatDate(obligation.dueDate)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Plano</p>
          <p className="mt-1 truncate font-semibold text-slate-200">{obligation.planId || "-"}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Criada em</p>
          <p className="mt-1 font-semibold text-slate-200">{formatDate(obligation.createdAt)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Atualizada</p>
          <p className="mt-1 font-semibold text-slate-200">{formatDate(obligation.updatedAt)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled={disabled || !canMarkPaid}
          onClick={() => onMarkPaid?.(obligation)}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500",
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          Baixar
        </button>
        <button
          type="button"
          disabled={disabled || !canMarkOverdue}
          onClick={() => onMarkOverdue?.(obligation)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          <Clock3 className="h-4 w-4" />
          Vencida
        </button>
        <button
          type="button"
          disabled={disabled || !canCancel}
          onClick={() => onCancel?.(obligation)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500"
        >
          <Ban className="h-4 w-4" />
          Cancelar
        </button>
      </div>
    </article>
  );
}
