import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Loader2,
  Search,
  ShieldCheck,
  UserRoundSearch,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { formatApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

import { AgendaTimeline } from "../components/AgendaTimeline";
import { useAgenda } from "../hooks/useAgenda";
import { useAttendance } from "../hooks/useAttendance";

import type {
  AgendaAdminSummaryResponse,
  AgendaClassSchedulesResponse,
  AgendaLookupInput,
  AgendaLookupMode,
  AgendaSchedule,
} from "../types/agenda.types";

const LOOKUP_OPTIONS: Array<{
  icon: typeof UserRoundSearch;
  label: string;
  mode: AgendaLookupMode;
}> = [
  { icon: UserRoundSearch, label: "Aluno", mode: "student" },
  { icon: ClipboardCheck, label: "Matricula", mode: "enrollment" },
  { icon: GraduationCap, label: "Turma", mode: "class" },
];

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function readSchedules(
  data: AgendaAdminSummaryResponse | AgendaClassSchedulesResponse | undefined,
) {
  if (!data) return [];

  const summary = data as AgendaAdminSummaryResponse;
  const schedules = [
    ...(Array.isArray(data.schedules) ? data.schedules : []),
    ...(Array.isArray(summary.scheduleCandidates) ? summary.scheduleCandidates : []),
    ...(Array.isArray(summary.agendaItems) ? summary.agendaItems : []),
  ];
  const seen = new Set<string>();

  return schedules.filter((schedule, index) => {
    const key =
      schedule.id ||
      schedule.agendaItemId ||
      [
        schedule.enrollmentId,
        schedule.classId,
        schedule.dayOfWeek,
        schedule.startTime,
        schedule.endTime,
        index,
      ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function readBlockers(data: AgendaAdminSummaryResponse | AgendaClassSchedulesResponse | undefined) {
  const blockers = (data as AgendaAdminSummaryResponse | undefined)?.blockers;
  return Array.isArray(blockers) ? blockers : [];
}

function countInactiveClasses(schedules: AgendaSchedule[]) {
  return schedules.filter((schedule) => {
    const status = normalizeUpper(schedule.classStatus || schedule.status || schedule.scheduleStatus);
    return ["INACTIVE", "INATIVA", "INATIVO", "CANCELLED", "CANCELADA", "CANCELADO"].includes(
      status,
    );
  }).length;
}

function countRegisteredAttendance(schedules: AgendaSchedule[]) {
  return schedules.filter((schedule) => {
    const status = normalizeUpper(schedule.attendanceStatus);

    return Boolean(
      schedule.present === true ||
        schedule.present === false ||
        schedule.attendanceRegisteredAt ||
        ["PRESENT", "PRESENTE", "ABSENT", "FALTA", "JUSTIFIED", "JUSTIFICADA"].includes(status),
    );
  }).length;
}

function readEmptyMessage(submitted: AgendaLookupInput | null) {
  if (!submitted) {
    return "Informe aluno, matricula ou turma para carregar a agenda administrativa.";
  }

  if (submitted.mode === "enrollment") {
    return "Matricula sem agenda ou sem vinculo ativo com turma.";
  }

  if (submitted.mode === "student") {
    return "Aluno sem horarios ativos vinculados a matricula.";
  }

  return "Turma sem horarios retornados pela API administrativa da Agenda.";
}

function AgendaAdminContent() {
  const [mode, setMode] = useState<AgendaLookupMode>("enrollment");
  const [studentPersonId, setStudentPersonId] = useState("");
  const [studentProfileId, setStudentProfileId] = useState("");
  const [enrollmentId, setEnrollmentId] = useState("");
  const [classId, setClassId] = useState("");
  const [submitted, setSubmitted] = useState<AgendaLookupInput | null>(null);

  const agendaQuery = useAgenda({
    classId: submitted?.classId || null,
    enabled: Boolean(submitted),
    enrollmentId: submitted?.enrollmentId || null,
    limit: 100,
    mode: submitted?.mode || mode,
    studentPersonId: submitted?.studentPersonId || null,
    studentProfileId: submitted?.studentProfileId || null,
  });
  const attendance = useAttendance();

  const schedules = useMemo(() => readSchedules(agendaQuery.data), [agendaQuery.data]);
  const blockers = readBlockers(agendaQuery.data);
  const inactiveClasses = countInactiveClasses(schedules);
  const registeredAttendance = countRegisteredAttendance(schedules);
  const pendingAttendance = Math.max(schedules.length - registeredAttendance, 0);
  const errorMessage = agendaQuery.error
    ? formatApiErrorMessage(
        agendaQuery.error,
        "Nao foi possivel carregar a API administrativa da Agenda.",
      )
    : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "student") {
      const nextStudentPersonId = studentPersonId.trim();
      const nextStudentProfileId = studentProfileId.trim();

      if (!nextStudentPersonId || !nextStudentProfileId) {
        toast.error("Informe pessoa e perfil do aluno.");
        return;
      }

      setSubmitted({
        mode,
        studentPersonId: nextStudentPersonId,
        studentProfileId: nextStudentProfileId,
      });
      return;
    }

    if (mode === "enrollment") {
      const nextEnrollmentId = enrollmentId.trim();

      if (!nextEnrollmentId) {
        toast.error("Informe o id da matricula.");
        return;
      }

      setSubmitted({ enrollmentId: nextEnrollmentId, mode });
      return;
    }

    const nextClassId = classId.trim();

    if (!nextClassId) {
      toast.error("Informe o id da turma.");
      return;
    }

    setSubmitted({ classId: nextClassId, mode });
  }

  function handlePrepareAttendance(schedule: AgendaSchedule) {
    const draft = attendance.prepareAttendanceDraft(schedule);

    if (draft.blockedReason) {
      toast.error(draft.blockedReason);
      return;
    }

    toast.success("Chamada preparada localmente. Nenhuma presenca foi gravada.");
  }

  return (
    <AppShell title="Agenda administrativa">
      <div className="j12-page-enter space-y-6">
        <section className="j12-surface overflow-hidden p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                <CalendarClock className="h-3.5 w-3.5" />
                Agenda admin
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-5xl">
                Horarios, aulas e presenca por matricula.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base">
                Interface preparada para consumir somente endpoints administrativos protegidos da
                Agenda.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" />
                <div>
                  <p className="font-bold text-white">Sem efeitos colaterais</p>
                  <p className="mt-1 leading-5">Nao gera financeiro, notificacao ou presenca.</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {LOOKUP_OPTIONS.map((option) => {
                const active = mode === option.mode;
                const Icon = option.icon;

                return (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => setMode(option.mode)}
                    className={cn(
                      "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition",
                      active
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            {mode === "student" && (
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                <LookupField
                  label="Pessoa do aluno"
                  onChange={setStudentPersonId}
                  placeholder="studentPersonId"
                  value={studentPersonId}
                />
                <LookupField
                  label="Perfil do aluno"
                  onChange={setStudentProfileId}
                  placeholder="studentProfileId"
                  value={studentProfileId}
                />
                <SubmitButton loading={agendaQuery.isFetching} />
              </div>
            )}

            {mode === "enrollment" && (
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <LookupField
                  label="Matricula"
                  onChange={setEnrollmentId}
                  placeholder="ID da matricula"
                  value={enrollmentId}
                />
                <SubmitButton loading={agendaQuery.isFetching} />
              </div>
            )}

            {mode === "class" && (
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <LookupField
                  label="Turma"
                  onChange={setClassId}
                  placeholder="ID da turma"
                  value={classId}
                />
                <SubmitButton loading={agendaQuery.isFetching} />
              </div>
            )}
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={CalendarClock}
            label="Horarios"
            value={schedules.length}
            detail="Itens retornados pela Agenda"
          />
          <MetricCard
            icon={GraduationCap}
            label="Turmas inativas"
            tone={inactiveClasses > 0 ? "warning" : "success"}
            value={inactiveClasses}
            detail="Aulas bloqueadas para chamada"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Presencas"
            tone="success"
            value={registeredAttendance}
            detail="Registros ja associados"
          />
          <MetricCard
            icon={AlertTriangle}
            label="Pendentes"
            tone={pendingAttendance > 0 ? "warning" : "success"}
            value={pendingAttendance}
            detail="Chamadas a preparar"
          />
        </section>

        {blockers.length > 0 && (
          <section className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-200" />
              <div>
                <p className="font-bold text-white">Limitacoes retornadas pela Agenda</p>
                <div className="mt-2 grid gap-2 text-sm">
                  {blockers.map((blocker, index) => (
                    <p key={`${blocker.code || "blocker"}-${index}`}>
                      {blocker.code ? `${blocker.code}: ` : ""}
                      {blocker.message || "Bloqueio sem mensagem detalhada."}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <AgendaTimeline
            emptyMessage={readEmptyMessage(submitted)}
            errorMessage={errorMessage}
            loading={agendaQuery.isFetching}
            onPrepareAttendance={handlePrepareAttendance}
            schedules={submitted ? schedules : []}
          />

          <aside className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-white">Preparacao de chamada</h2>
            </div>

            {attendance.draft ? (
              <div className="grid gap-3 text-sm">
                <InfoRow label="Status" value={attendance.draft.status} />
                <InfoRow label="Horario" value={attendance.draft.scheduleLabel} />
                <InfoRow label="Matricula" value={attendance.draft.enrollmentId || "-"} />
                <InfoRow label="Turma" value={attendance.draft.classId || "-"} />
                <InfoRow
                  label="Resultado"
                  value={
                    attendance.draft.blockedReason ||
                    "Rascunho preparado sem gravar presenca no backend."
                  }
                />
                <button
                  type="button"
                  onClick={attendance.resetAttendanceDraft}
                  className="mt-1 inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-white transition hover:bg-white/10"
                >
                  Limpar preparacao
                </button>
              </div>
            ) : (
              <div className="j12-empty-state p-6 text-center">
                <ClipboardCheck className="mx-auto h-9 w-9 text-primary" />
                <p className="mt-3 font-bold text-white">Nenhuma chamada preparada.</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Selecione um horario ativo para preparar a marcacao de presenca.
                </p>
              </div>
            )}
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

function AgendaAdminPage() {
  return (
    <ProtectedRoute roles={["admin", "coordenador"]}>
      <AgendaAdminContent />
    </ProtectedRoute>
  );
}

function LookupField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="j12-field h-12 w-full px-4"
        placeholder={placeholder}
      />
    </label>
  );
}

function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 lg:mt-7"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
      Consultar
    </button>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  tone = "primary",
  value,
}: {
  detail: string;
  icon: typeof CalendarClock;
  label: string;
  tone?: "primary" | "success" | "warning";
  value: number;
}) {
  const toneClass = {
    primary: "border-primary/25 bg-primary/10 text-primary",
    success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    warning: "border-amber-400/20 bg-amber-500/10 text-amber-100",
  }[tone];

  return (
    <article className="j12-kpi-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black text-white">{value}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
        </div>
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", toneClass)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white">
        {normalizeText(value) || "-"}
      </p>
    </div>
  );
}

export { AgendaAdminPage, AgendaAdminContent };
