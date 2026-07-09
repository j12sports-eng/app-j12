import { type FormEvent, useState } from "react";
import { Edit3, Loader2, Save, Trash2, X, type LucideIcon } from "lucide-react";

import type {
  ChampionshipMatchEvent,
  ChampionshipMatchEventUpdatePayload,
} from "../types/championship.types";

type ChampionshipMatchEventsListProps = {
  busyEventId?: string | null;
  disabled?: boolean;
  events: ChampionshipMatchEvent[];
  onDelete?: (eventId: string) => void;
  onUpdate?: (eventId: string, payload: ChampionshipMatchEventUpdatePayload) => void;
};

type EventEditValues = {
  description: string;
  minute: string;
  period: string;
};

export function ChampionshipMatchEventsList({
  busyEventId,
  disabled,
  events,
  onDelete,
  onUpdate,
}: ChampionshipMatchEventsListProps) {
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [values, setValues] = useState<EventEditValues>({
    description: "",
    minute: "",
    period: "",
  });

  function startEditing(event: ChampionshipMatchEvent) {
    setEditingEventId(event.id);
    setValues({
      description: event.description || "",
      minute: event.minute === null ? "" : String(event.minute),
      period: event.period || "",
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingEventId) return;

    onUpdate?.(editingEventId, {
      description: values.description.trim() || null,
      minute: parseOptionalNumber(values.minute),
      period: values.period.trim() || null,
    });
    setEditingEventId(null);
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
        <p className="text-sm font-black text-white">Nenhum evento registrado</p>
        <p className="mt-1 text-sm text-slate-500">
          Gols, cartoes, faltas e substituicoes aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-card p-5">
      <div className="mb-4">
        <h3 className="text-lg font-black text-white">Eventos da sumula</h3>
        <p className="mt-1 text-sm text-slate-500">Revise e ajuste registros antes de finalizar.</p>
      </div>

      <div className="grid gap-2">
        {events.map((event) => {
          const isBusy = busyEventId === event.id;
          const isEditing = editingEventId === event.id;

          return (
            <article key={event.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
              {isEditing ? (
                <form
                  onSubmit={handleSubmit}
                  className="grid gap-2 md:grid-cols-[90px_110px_1fr_auto]"
                >
                  <input
                    type="number"
                    min="0"
                    value={values.minute}
                    onChange={(inputEvent) =>
                      setValues((current) => ({ ...current, minute: inputEvent.target.value }))
                    }
                    className={fieldClassName}
                    placeholder="Min."
                  />
                  <input
                    value={values.period}
                    onChange={(inputEvent) =>
                      setValues((current) => ({ ...current, period: inputEvent.target.value }))
                    }
                    className={fieldClassName}
                    placeholder="Periodo"
                  />
                  <input
                    value={values.description}
                    onChange={(inputEvent) =>
                      setValues((current) => ({
                        ...current,
                        description: inputEvent.target.value,
                      }))
                    }
                    className={fieldClassName}
                    placeholder="Descricao"
                  />
                  <div className="flex gap-2">
                    <IconButton
                      disabled={disabled || isBusy}
                      icon={Save}
                      label="Salvar"
                      type="submit"
                    />
                    <IconButton
                      disabled={isBusy}
                      icon={X}
                      label="Cancelar"
                      onClick={() => setEditingEventId(null)}
                      type="button"
                    />
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-white">
                        {formatEventType(event.eventType)}
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        {event.minute === null ? "sem minuto" : `${event.minute}'`}
                      </span>
                      {event.teamName ? (
                        <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-primary">
                          {event.teamAcronym || event.teamName}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-300">
                      {event.playerName || event.relatedPlayerName || event.description || "-"}
                    </p>
                    {event.description ? (
                      <p className="mt-1 text-xs leading-5 text-slate-500">{event.description}</p>
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    <IconButton
                      disabled={disabled || isBusy}
                      icon={isBusy ? Loader2 : Edit3}
                      label="Editar"
                      onClick={() => startEditing(event)}
                      type="button"
                    />
                    <IconButton
                      disabled={disabled || isBusy}
                      icon={isBusy ? Loader2 : Trash2}
                      label="Remover"
                      onClick={() => onDelete?.(event.id)}
                      type="button"
                    />
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function IconButton({
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
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className={`h-4 w-4 ${Icon === Loader2 ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function formatEventType(eventType: ChampionshipMatchEvent["eventType"]) {
  const labels: Record<ChampionshipMatchEvent["eventType"], string> = {
    FOUL: "Falta",
    GOAL: "Gol",
    OBSERVATION: "Observacao",
    RED_CARD: "Cartao vermelho",
    SUBSTITUTION: "Substituicao",
    TECHNICAL_TIMEOUT: "Tempo tecnico",
    WALKOVER: "W.O.",
    YELLOW_CARD: "Cartao amarelo",
  };

  return labels[eventType];
}

const fieldClassName =
  "min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15";
