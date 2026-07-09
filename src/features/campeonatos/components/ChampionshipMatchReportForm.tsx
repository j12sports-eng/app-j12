import { type FormEvent, useEffect, useState } from "react";
import { FileCheck2, Loader2, Lock, Play, RotateCcw, Save, type LucideIcon } from "lucide-react";

import type {
  ChampionshipMatchReport,
  ChampionshipMatchReportFinalizePayload,
  ChampionshipMatchReportPayload,
} from "../types/championship.types";

type ChampionshipMatchReportFormProps = {
  disabled?: boolean;
  isCreating?: boolean;
  isFinalizing?: boolean;
  isOpening?: boolean;
  isReopening?: boolean;
  isSaving?: boolean;
  onCreate?: (payload: ChampionshipMatchReportPayload) => void;
  onFinalize?: (payload: ChampionshipMatchReportFinalizePayload) => void;
  onOpen?: () => void;
  onReopen?: () => void;
  onSave?: (payload: ChampionshipMatchReportPayload) => void;
  report: ChampionshipMatchReport | null;
};

type FormValues = {
  assistantReferee: string;
  awayScore: string;
  homeScore: string;
  observations: string;
  referee: string;
  scorer: string;
};

const EMPTY_VALUES: FormValues = {
  assistantReferee: "",
  awayScore: "",
  homeScore: "",
  observations: "",
  referee: "",
  scorer: "",
};

export function ChampionshipMatchReportForm({
  disabled,
  isCreating,
  isFinalizing,
  isOpening,
  isReopening,
  isSaving,
  onCreate,
  onFinalize,
  onOpen,
  onReopen,
  onSave,
  report,
}: ChampionshipMatchReportFormProps) {
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const isFinished = report?.status === "FINISHED";
  const isBusy = Boolean(isCreating || isFinalizing || isOpening || isReopening || isSaving);
  const canEdit = Boolean(report && !isFinished && !disabled);

  useEffect(() => {
    setValues({
      assistantReferee: report?.assistantReferee || "",
      awayScore:
        report?.awayScore === null || typeof report?.awayScore === "undefined"
          ? ""
          : String(report.awayScore),
      homeScore:
        report?.homeScore === null || typeof report?.homeScore === "undefined"
          ? ""
          : String(report.homeScore),
      observations: report?.observations || "",
      referee: report?.referee || "",
      scorer: report?.scorer || "",
    });
  }, [report]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = readReportPayload(values);

    if (report) {
      onSave?.(payload);
    } else {
      onCreate?.(payload);
    }
  }

  function handleFinalize() {
    onFinalize?.({
      awayScore: parseScore(values.awayScore),
      homeScore: parseScore(values.homeScore),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-card p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-white">Dados da sumula</h3>
          <p className="mt-1 text-sm text-slate-500">
            Arbitragem, anotador, observacoes e placar final.
          </p>
        </div>
        <span className="inline-flex min-h-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-black uppercase tracking-[0.12em] text-primary">
          {report ? formatStatus(report.status) : "Nao criada"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <input
          value={values.referee}
          onChange={(event) =>
            setValues((current) => ({ ...current, referee: event.target.value }))
          }
          disabled={disabled || isBusy || isFinished}
          className={fieldClassName}
          placeholder="Arbitro"
        />
        <input
          value={values.assistantReferee}
          onChange={(event) =>
            setValues((current) => ({ ...current, assistantReferee: event.target.value }))
          }
          disabled={disabled || isBusy || isFinished}
          className={fieldClassName}
          placeholder="Arbitro assistente"
        />
        <input
          value={values.scorer}
          onChange={(event) => setValues((current) => ({ ...current, scorer: event.target.value }))}
          disabled={disabled || isBusy || isFinished}
          className={fieldClassName}
          placeholder="Anotador"
        />
      </div>

      <textarea
        value={values.observations}
        onChange={(event) =>
          setValues((current) => ({ ...current, observations: event.target.value }))
        }
        disabled={disabled || isBusy || isFinished}
        className={`${fieldClassName} mt-3 min-h-28 py-3`}
        placeholder="Observacoes gerais"
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          type="number"
          min="0"
          value={values.homeScore}
          onChange={(event) =>
            setValues((current) => ({ ...current, homeScore: event.target.value }))
          }
          disabled={disabled || isBusy || isFinished}
          className={fieldClassName}
          placeholder="Placar mandante"
        />
        <input
          type="number"
          min="0"
          value={values.awayScore}
          onChange={(event) =>
            setValues((current) => ({ ...current, awayScore: event.target.value }))
          }
          disabled={disabled || isBusy || isFinished}
          className={fieldClassName}
          placeholder="Placar visitante"
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <ActionButton
          disabled={disabled || isBusy || isFinished}
          icon={isBusy && !report ? Loader2 : Save}
          label={report ? "Salvar" : "Criar sumula"}
          type="submit"
        />
        <ActionButton
          disabled={!canEdit || isBusy}
          icon={isOpening ? Loader2 : Play}
          label="Abrir"
          onClick={onOpen}
          type="button"
        />
        <ActionButton
          disabled={!canEdit || isBusy}
          icon={isFinalizing ? Loader2 : FileCheck2}
          label="Finalizar"
          onClick={handleFinalize}
          type="button"
        />
        <ActionButton
          disabled={!report || !isFinished || disabled || isBusy}
          icon={isReopening ? Loader2 : RotateCcw}
          label="Reabrir"
          onClick={onReopen}
          type="button"
        />
      </div>

      {isFinished ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-slate-400">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Sumula finalizada. Reabra para editar eventos ou dados administrativos.
        </div>
      ) : null}
    </form>
  );
}

function ActionButton({
  disabled,
  icon: Icon,
  label,
  onClick,
  type,
}: {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  type: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Icon className={`h-4 w-4 ${Icon === Loader2 ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}

function readReportPayload(values: FormValues): ChampionshipMatchReportPayload {
  return {
    assistantReferee: values.assistantReferee.trim() || null,
    observations: values.observations.trim() || null,
    referee: values.referee.trim() || null,
    scorer: values.scorer.trim() || null,
  };
}

function parseScore(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : undefined;
}

function formatStatus(status: ChampionshipMatchReport["status"]) {
  const labels: Record<ChampionshipMatchReport["status"], string> = {
    DRAFT: "Rascunho",
    FINISHED: "Finalizada",
    OPEN: "Aberta",
    REOPENED: "Reaberta",
  };

  return labels[status];
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";
