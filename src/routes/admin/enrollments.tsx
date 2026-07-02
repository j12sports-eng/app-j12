import { FormEvent, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EnrollmentStatusBadge } from "@/components/enrollments/EnrollmentStatusBadge";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useEnrollmentStatus } from "@/hooks/useEnrollmentStatus";
import { formatApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  searchEnrollmentStudentScopes,
  type EnrollmentStudentScopeSearchResult,
  type EnrollmentRecord,
  type EnrollmentStatusSummary,
  type EnrollmentSummaryStatus,
} from "@/lib/enrollments-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/enrollments")({
  component: EnrollmentsAdminPage,
});

const STATUS_DETAIL: Record<EnrollmentSummaryStatus, string> = {
  ACTIVE: "Existe matricula ativa para este aluno/perfil.",
  CONFLICT: "Existe DRAFT e ACTIVE simultaneamente. Confirmacao bloqueada.",
  DRAFT: "Existe rascunho elegivel para revisao administrativa.",
  NONE: "Nenhuma matricula atual encontrada para este aluno/perfil.",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatValue(value: unknown) {
  const normalized = String(value ?? "").trim();

  return normalized || "-";
}

function readConfirmGuard(summary: EnrollmentStatusSummary | null) {
  if (!summary) return "Consulte uma matricula antes de confirmar.";
  if (summary.status === "CONFLICT") return "Bloqueado por conflito entre DRAFT e ACTIVE.";
  if (summary.status === "ACTIVE") return "Bloqueado porque ja existe matricula ACTIVE.";
  if (summary.status === "NONE") return "Bloqueado porque nao existe DRAFT atual.";
  if (!summary.draftEnrollment?.id) return "Bloqueado porque o DRAFT nao possui id valido.";

  return "Confirmacao disponivel para DRAFT sem ACTIVE conflitante.";
}

function EnrollmentsAdminPage() {
  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <EnrollmentsAdminContent />
    </ProtectedRoute>
  );
}

function EnrollmentsAdminContent() {
  const { hasRole, user } = useAuth();
  const {
    actionLoading,
    activeEnrollment,
    canConfirm,
    confirmDraft,
    draftEnrollment,
    error,
    loadStatus,
    loading,
    message,
    status,
    summary,
  } = useEnrollmentStatus();
  const [studentPersonId, setStudentPersonId] = useState("");
  const [studentProfileId, setStudentProfileId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentSearchError, setStudentSearchError] = useState<string | null>(null);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [studentSearchResults, setStudentSearchResults] = useState<
    EnrollmentStudentScopeSearchResult[]
  >([]);

  const confirmGuard = useMemo(() => readConfirmGuard(summary), [summary]);
  const confirmedBy = String(user?.email || user?.nome || user?.id || "admin").trim();
  const canUseAdminActions = hasRole("admin", "coordenador");
  const canConfirmSafely = canUseAdminActions && canConfirm;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await loadStatus({
      studentPersonId,
      studentProfileId,
    });
  }

  async function handleStudentSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = studentSearch.trim();

    if (query.length < 2) {
      setStudentSearchError("Informe ao menos 2 caracteres para buscar aluno.");
      setStudentSearchResults([]);
      return;
    }

    try {
      setStudentSearchError(null);
      setStudentSearchLoading(true);

      const results = await searchEnrollmentStudentScopes({ limit: 12, query });

      setStudentSearchResults(results);

      if (!results.length) {
        setStudentSearchError("Nenhum aluno encontrado para a busca informada.");
      }
    } catch (error) {
      setStudentSearchError(formatApiErrorMessage(error, "Nao foi possivel buscar alunos."));
      setStudentSearchResults([]);
    } finally {
      setStudentSearchLoading(false);
    }
  }

  async function handleSelectStudentScope(result: EnrollmentStudentScopeSearchResult) {
    const nextStudentPersonId = String(result.studentPersonId ?? "").trim();
    const nextStudentProfileId = String(result.studentProfileId ?? "").trim();

    if (!nextStudentPersonId || !nextStudentProfileId) {
      toast.error("Aluno sem escopo tecnico valido para consulta.");
      return;
    }

    setStudentPersonId(nextStudentPersonId);
    setStudentProfileId(nextStudentProfileId);

    await loadStatus({
      studentPersonId: nextStudentPersonId,
      studentProfileId: nextStudentProfileId,
    });
  }

  async function handleConfirm() {
    if (!canConfirmSafely) {
      toast.error("Confirmacao bloqueada para este usuario ou estado da matricula.");
      return;
    }

    const result = await confirmDraft(confirmedBy);

    if (result?.confirmed || result?.alreadyConfirmed) {
      toast.success(result.alreadyConfirmed ? "Matricula ja estava ativa." : "Matricula ativada.");
      return;
    }

    toast.error("Confirmacao nao executada.");
  }

  return (
    <AppShell title="Matriculas">
      <div className="j12-page-enter space-y-6">
        <section className="j12-surface overflow-hidden p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase text-primary">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Administrativo
              </div>
              <h1 className="mt-4 text-3xl font-bold text-white md:text-5xl">
                Matriculas por aluno e perfil
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base">
                Status consolidado, leitura de DRAFT/ACTIVE e confirmacao guardada pelo contrato
                admin.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" />
                <div>
                  <p className="font-bold text-white">Rota protegida</p>
                  <p className="mt-1 leading-5">Admin/coordenador via API administrativa.</p>
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleStudentSearchSubmit}
            className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto]"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-300">
                Buscar aluno
              </span>
              <input
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                className="j12-field h-12 w-full px-4"
                placeholder="Nome, CPF, email, pessoa ou perfil"
              />
            </label>

            <button
              type="submit"
              disabled={studentSearchLoading}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 lg:mt-7"
            >
              {studentSearchLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Buscar
            </button>
          </form>

          {(studentSearchError || studentSearchResults.length > 0) && (
            <div className="mt-4 space-y-3">
              {studentSearchError && (
                <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  {studentSearchError}
                </div>
              )}

              {studentSearchResults.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {studentSearchResults.map((result) => (
                    <StudentScopeSearchCard
                      key={`${result.studentPersonId}-${result.studentProfileId}`}
                      result={result}
                      onSelect={handleSelectStudentScope}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-6 grid gap-3 border-t border-white/10 pt-5 lg:grid-cols-[1fr_1fr_auto]"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-300">
                Student person ID
              </span>
              <input
                value={studentPersonId}
                onChange={(event) => setStudentPersonId(event.target.value)}
                className="j12-field h-12 w-full px-4"
                placeholder="Ex.: 123"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-300">
                Student profile ID
              </span>
              <input
                value={studentProfileId}
                onChange={(event) => setStudentProfileId(event.target.value)}
                className="j12-field h-12 w-full px-4"
                placeholder="Ex.: 456"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 lg:mt-7"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Consultar
            </button>
          </form>

          {(error || message) && (
            <div
              className={cn(
                "mt-5 rounded-2xl border px-4 py-3 text-sm",
                error
                  ? "border-red-400/25 bg-red-500/10 text-red-100"
                  : "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
              )}
            >
              {error || message}
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="j12-kpi-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-400">Status consolidado</p>
                <div className="mt-3">
                  <EnrollmentStatusBadge status={status} />
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-300">{STATUS_DETAIL[status]}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                <FileSearch className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 grid gap-2 text-sm">
              <InfoRow
                label="studentPersonId"
                value={summary?.studentPersonId ?? studentPersonId}
              />
              <InfoRow
                label="studentProfileId"
                value={summary?.studentProfileId ?? studentProfileId}
              />
              <InfoRow
                label="hasDraftEnrollment"
                value={summary ? String(summary.hasDraftEnrollment) : "-"}
              />
              <InfoRow
                label="hasActiveEnrollment"
                value={summary ? String(summary.hasActiveEnrollment) : "-"}
              />
            </div>
          </div>

          <div className="j12-surface p-5">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">Confirmacao DRAFT</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {canUseAdminActions ? confirmGuard : "Bloqueado por permissao administrativa."}
                </p>
              </div>
              {canConfirmSafely ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-300" />
              )}
            </div>

            <button
              onClick={handleConfirm}
              disabled={!canConfirmSafely || actionLoading}
              className={cn(
                "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition",
                canConfirmSafely
                  ? "bg-primary text-primary-foreground hover:brightness-110"
                  : "border border-white/10 bg-white/5 text-slate-500",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Confirmar matricula
            </button>

            <button
              onClick={() => loadStatus({ studentPersonId, studentProfileId })}
              disabled={loading || actionLoading}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              Recarregar status
            </button>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <EnrollmentRecordPanel record={draftEnrollment} title="Matricula DRAFT" tone="draft" />
          <EnrollmentRecordPanel record={activeEnrollment} title="Matricula ACTIVE" tone="active" />
        </section>
      </div>
    </AppShell>
  );
}

function StudentScopeSearchCard({
  onSelect,
  result,
}: {
  onSelect: (result: EnrollmentStudentScopeSearchResult) => Promise<void> | void;
  result: EnrollmentStudentScopeSearchResult;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-white">
            {formatValue(result.studentName || "Aluno sem nome")}
          </p>
          <p className="mt-1 truncate text-xs text-slate-400">
            CPF {formatValue(result.studentCpf)} · {formatValue(result.studentEmail)}
          </p>
        </div>
        <EnrollmentStatusBadge status={result.status} />
      </div>

      <div className="mt-4 grid gap-2 text-xs">
        <InfoRow label="Pessoa" value={result.studentPersonId} />
        <InfoRow label="Perfil" value={result.studentProfileId} />
        <InfoRow label="Atualizado" value={formatDate(result.lastEnrollmentAt)} />
      </div>

      <button
        type="button"
        onClick={() => void onSelect(result)}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-bold text-primary transition hover:bg-primary hover:text-primary-foreground"
      >
        <UserRoundCheck className="h-4 w-4" />
        Selecionar aluno
      </button>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="min-w-0 break-all text-right font-semibold text-white">
        {formatValue(value)}
      </span>
    </div>
  );
}

function EnrollmentRecordPanel({
  record,
  title,
  tone,
}: {
  record: EnrollmentRecord | null;
  title: string;
  tone: "active" | "draft";
}) {
  const toneClass =
    tone === "active"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : "border-amber-400/20 bg-amber-500/10 text-amber-200";

  return (
    <article className="j12-surface p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {record ? "Registro atual encontrado." : "Nenhum registro atual."}
          </p>
        </div>
        <span className={cn("rounded-full border px-3 py-1 text-xs font-bold", toneClass)}>
          {record?.status ?? "NONE"}
        </span>
      </div>

      {record ? (
        <div className="grid gap-2 text-sm">
          <InfoRow label="id" value={record.id} />
          <InfoRow label="studentPersonId" value={record.studentPersonId} />
          <InfoRow label="studentProfileId" value={record.studentProfileId} />
          <InfoRow label="startDate" value={formatDate(record.startDate)} />
          <InfoRow label="endDate" value={formatDate(record.endDate)} />
          <InfoRow label="confirmedAt" value={formatDate(record.confirmedAt)} />
          <InfoRow label="confirmedBy" value={record.confirmedBy} />
          <InfoRow label="updatedAt" value={formatDate(record.updatedAt)} />
        </div>
      ) : (
        <div className="j12-empty-state p-8 text-center">
          <p className="font-bold text-white">Sem dados para exibir.</p>
          <p className="mt-2 text-sm text-slate-400">A consulta nao retornou este estado.</p>
        </div>
      )}
    </article>
  );
}
