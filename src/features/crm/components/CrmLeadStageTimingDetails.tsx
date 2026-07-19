import { AlertTriangle, Clock3 } from "lucide-react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { CrmLeadSlaBadge } from "./CrmLeadSlaBadge";
import type { CrmLeadStageTimingDetail } from "../types/crm-lead-stage-timing.types";

export function CrmLeadStageTimingDetails({
  data,
  error,
  isLoading,
  nowMs,
}: {
  data?: CrmLeadStageTimingDetail;
  error?: string | null;
  isLoading: boolean;
  nowMs: number;
}) {
  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
      aria-labelledby="crm-lead-timing-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3
            id="crm-lead-timing-title"
            className="flex items-center gap-2 font-semibold text-white"
          >
            <Clock3 aria-hidden="true" className="h-4 w-4 text-primary" />
            Tempo no funil
          </h3>
          <p className="mt-1 text-xs text-slate-400">Durações derivadas do histórico persistido.</p>
        </div>
        <CrmLeadSlaBadge timing={data} />
      </div>
      {isLoading ? (
        <div className="mt-4">
          <SkeletonCard announce lines={3} />
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-4 flex gap-2 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100"
        >
          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}
      {data ? (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Value label="Etapa atual" value={data.currentStage.replaceAll("_", " ")} />
            <Value label="Entrou em" value={formatInstant(data.currentStageEntryAt)} />
            <Value label="Tempo atual" value={formatDuration(displayElapsed(data, nowMs))} />
            <Value label="Cobertura" value={coverageLabel(data.historyCoverage)} />
          </dl>
          {data.stages.length ? (
            <div>
              <h4 className="text-sm font-semibold text-white">Resumo por etapa</h4>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {data.stages.map((stage) => (
                  <div
                    key={stage.stage}
                    className="rounded-xl border border-white/8 bg-black/10 px-3 py-2 text-xs text-slate-300"
                  >
                    <div className="flex justify-between gap-3">
                      <span>{stage.stage.replaceAll("_", " ")}</span>
                      <strong className="text-white">
                        {formatDuration(stage.totalDurationMs)}
                      </strong>
                    </div>
                    <p className="mt-1 text-slate-500">{stage.visitCount} visita(s)</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Sem histórico de etapas disponível.</p>
          )}
          {data.timeline.length ? (
            <div>
              <h4 className="text-sm font-semibold text-white">Timeline</h4>
              <ol className="mt-2 space-y-2">
                {data.timeline.map((period, index) => (
                  <li
                    key={`${period.entryAt}-${period.stage}-${index}`}
                    className="rounded-xl border border-white/8 bg-black/10 px-3 py-2 text-xs text-slate-300"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-semibold text-white">
                        {period.stage.replaceAll("_", " ")}
                      </span>
                      <span>{formatDuration(period.durationMs)}</span>
                    </div>
                    <p className="mt-1 text-slate-500">
                      {formatInstant(period.entryAt)} →{" "}
                      {period.exitAt
                        ? formatInstant(period.exitAt)
                        : period.isCurrent
                          ? "agora"
                          : "saída desconhecida"}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function displayElapsed(
  timing: {
    currentStageElapsedMs: number | null;
    currentStageEntryAt: string | null;
    sla: { status: string };
  },
  nowMs: number,
) {
  if (timing.currentStageElapsedMs == null) return null;
  if (timing.sla.status === "COMPLETED" || !timing.currentStageEntryAt)
    return timing.currentStageElapsedMs;
  const entry = Date.parse(timing.currentStageEntryAt);
  return Number.isNaN(entry)
    ? timing.currentStageElapsedMs
    : Math.max(timing.currentStageElapsedMs, nowMs - entry, 0);
}

export function formatDuration(value: number | null) {
  if (value == null) return "Indisponível";
  const minutes = Math.floor(Math.max(0, value) / 60_000);
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}min`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/10 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-white">{value}</dd>
    </div>
  );
}
function formatInstant(value: string | null) {
  if (!value) return "Indisponível";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Indisponível" : date.toLocaleString("pt-BR");
}
function coverageLabel(value: string) {
  return value === "COMPLETE"
    ? "Completa"
    : value === "PARTIAL"
      ? "Dados parciais"
      : "Indisponível";
}
