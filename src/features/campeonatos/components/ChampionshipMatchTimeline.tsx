import {
  AlertTriangle,
  ArrowRightLeft,
  CircleDot,
  ClipboardList,
  Clock3,
  ShieldAlert,
  Timer,
} from "lucide-react";

import type { ChampionshipMatchEvent } from "../types/championship.types";

type ChampionshipMatchTimelineProps = {
  events: ChampionshipMatchEvent[];
};

export function ChampionshipMatchTimeline({ events }: ChampionshipMatchTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
        <Clock3 className="mx-auto h-8 w-8 text-slate-500" />
        <p className="mt-3 text-sm font-black text-white">Linha do tempo vazia</p>
        <p className="mt-1 text-sm text-slate-500">
          Registre eventos da partida para compor a sumula.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">Linha do tempo</h3>
          <p className="mt-1 text-sm text-slate-500">{events.length} evento(s) registrados</p>
        </div>
        <ClipboardList className="h-5 w-5 text-primary" />
      </div>

      <div className="relative grid gap-3">
        {events.map((event) => {
          const Icon = getEventIcon(event.eventType);
          return (
            <article
              key={event.id}
              className="flex gap-3 rounded-xl border border-white/10 bg-black/25 p-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-white">
                    {formatEventType(event.eventType)}
                  </span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    {event.minute === null ? "sem minuto" : `${event.minute}'`}
                  </span>
                  {event.period ? (
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                      {event.period}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-300">
                  {event.playerName || event.teamName || event.description || "Evento registrado"}
                </p>
                {event.relatedPlayerName ? (
                  <p className="mt-1 text-xs text-slate-500">Saiu: {event.relatedPlayerName}</p>
                ) : null}
                {event.description && event.description !== event.playerName ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">{event.description}</p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function getEventIcon(eventType: ChampionshipMatchEvent["eventType"]) {
  if (eventType === "GOAL") return CircleDot;
  if (eventType === "YELLOW_CARD" || eventType === "RED_CARD") return ShieldAlert;
  if (eventType === "SUBSTITUTION") return ArrowRightLeft;
  if (eventType === "TECHNICAL_TIMEOUT") return Timer;
  if (eventType === "WALKOVER") return AlertTriangle;
  return ClipboardList;
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
