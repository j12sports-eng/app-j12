import { Trophy } from "lucide-react";

import { CHAMPIONSHIP_BRACKET_PHASE_LABELS } from "../constants/championship.constants";
import { ChampionshipBracketMatchCard } from "./ChampionshipBracketMatchCard";

import type {
  ChampionshipBracket,
  ChampionshipBracketFilters,
  ChampionshipBracketMatch,
  ChampionshipBracketMatchUpdatePayload,
  ChampionshipStanding,
} from "../types/championship.types";

type ChampionshipBracketTreeProps = {
  bracket: ChampionshipBracket;
  busyMatchId?: string | null;
  filters: ChampionshipBracketFilters;
  onAdvance: (match: ChampionshipBracketMatch) => void;
  onUpdate: (matchId: string, payload: ChampionshipBracketMatchUpdatePayload) => void;
  teamOptions: ChampionshipStanding[];
};

export function ChampionshipBracketTree({
  bracket,
  busyMatchId,
  filters,
  onAdvance,
  onUpdate,
  teamOptions,
}: ChampionshipBracketTreeProps) {
  const phases = (bracket.phases || []).filter((phase) =>
    filters.phase ? phase.phase === filters.phase : true,
  );

  if (phases.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <Trophy className="mx-auto h-8 w-8 text-slate-500" />
        <p className="mt-3 text-sm font-black text-white">Mata-mata sem jogos nesta fase</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Ajuste os filtros ou gere um novo chaveamento antes do inicio da fase.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {phases.map((phase) => (
        <section key={phase.phase} className="rounded-2xl border border-white/10 bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                {CHAMPIONSHIP_BRACKET_PHASE_LABELS[phase.phase]}
              </p>
              <h3 className="mt-1 text-lg font-black text-white">{phase.total} confronto(s)</h3>
            </div>
            <Trophy className="h-5 w-5 text-primary" />
          </div>

          <div className="grid gap-3">
            {phase.matches.map((match) => (
              <ChampionshipBracketMatchCard
                key={match.id}
                isBusy={busyMatchId === match.id}
                match={match}
                teamOptions={teamOptions}
                onAdvance={onAdvance}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
