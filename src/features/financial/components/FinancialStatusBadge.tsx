import { CheckCircle2, Clock3, PauseCircle, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import type { FinancialObligationStatus } from "../types/financial.types";

const STATUS_LABELS: Record<string, string> = {
  CANCELLED: "Cancelada",
  OVERDUE: "Vencida",
  PAID: "Paga",
  PENDING: "Pendente",
  PREPARED: "Preparada",
};

function normalizeFinancialStatus(status: FinancialObligationStatus | null | undefined) {
  return String(status || "PENDING")
    .trim()
    .toUpperCase();
}

export function FinancialStatusBadge({
  status,
}: {
  status: FinancialObligationStatus | null | undefined;
}) {
  const normalized = normalizeFinancialStatus(status);
  const Icon =
    normalized === "PAID"
      ? CheckCircle2
      : normalized === "OVERDUE"
        ? Clock3
        : normalized === "CANCELLED"
          ? XCircle
          : PauseCircle;

  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
        normalized === "PAID" && "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
        normalized === "PENDING" && "border-amber-400/25 bg-amber-500/10 text-amber-100",
        normalized === "PREPARED" && "border-primary/25 bg-primary/10 text-primary",
        normalized === "OVERDUE" && "border-red-400/25 bg-red-500/10 text-red-100",
        normalized === "CANCELLED" && "border-slate-400/20 bg-slate-500/10 text-slate-200",
        !["PAID", "PENDING", "PREPARED", "OVERDUE", "CANCELLED"].includes(normalized) &&
          "border-white/10 bg-white/5 text-slate-200",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {STATUS_LABELS[normalized] || normalized}
    </span>
  );
}

export function getFinancialStatusLabel(status: FinancialObligationStatus | null | undefined) {
  const normalized = normalizeFinancialStatus(status);

  return STATUS_LABELS[normalized] || normalized;
}
