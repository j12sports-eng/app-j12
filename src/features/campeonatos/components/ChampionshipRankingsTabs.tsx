import type { ReactNode } from "react";
import { AlertTriangle, Goal, ShieldCheck, ShieldMinus, Trophy } from "lucide-react";

import { CHAMPIONSHIP_RANKING_OPTIONS } from "../constants/championship.constants";

import type {
  ChampionshipRankingType,
  ChampionshipRankings,
  ChampionshipTeamRankingItem,
  ChampionshipTopScorerRankingItem,
} from "../types/championship.types";

type ChampionshipRankingsTabsProps = {
  activeRanking: ChampionshipRankingType;
  errorMessage?: string;
  isLoading?: boolean;
  onRankingChange: (ranking: ChampionshipRankingType) => void;
  rankings: ChampionshipRankings | null;
};

export function ChampionshipRankingsTabs({
  activeRanking,
  errorMessage = "",
  isLoading = false,
  onRankingChange,
  rankings,
}: ChampionshipRankingsTabsProps) {
  const items = readRankingItems(activeRanking, rankings);

  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-black text-white">Rankings</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Artilharia, fair play, melhor ataque e melhor defesa do campeonato.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CHAMPIONSHIP_RANKING_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onRankingChange(option.value)}
              className={`inline-flex min-h-10 items-center justify-center rounded-xl border px-3 text-sm font-black transition ${
                activeRanking === option.value
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {errorMessage ? (
        <RankingState
          icon={AlertTriangle}
          title="Falha ao carregar rankings"
          description={errorMessage}
        />
      ) : isLoading ? (
        <RankingSkeleton />
      ) : items.length === 0 ? (
        <RankingState
          icon={Trophy}
          title="Ranking vazio"
          description="Ainda nao ha dados suficientes para este ranking."
        />
      ) : (
        <div className="grid gap-2">
          {items.map((item) => (
            <RankingItem key={`${activeRanking}:${item.position}:${item.id || itemKey(item)}`}>
              <RankingIcon ranking={activeRanking} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{itemLabel(item)}</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">{itemMeta(item)}</p>
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                #{item.position}
              </span>
            </RankingItem>
          ))}
        </div>
      )}
    </section>
  );
}

function readRankingItems(ranking: ChampionshipRankingType, rankings: ChampionshipRankings | null) {
  if (!rankings) return [];
  return rankings[ranking] || [];
}

function RankingItem({ children }: { children: ReactNode }) {
  return (
    <article className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      {children}
    </article>
  );
}

function RankingIcon({ ranking }: { ranking: ChampionshipRankingType }) {
  const Icon =
    ranking === "topScorers"
      ? Trophy
      : ranking === "fairPlay"
        ? ShieldCheck
        : ranking === "bestDefense"
          ? ShieldMinus
          : Goal;

  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
      <Icon className="h-5 w-5" />
    </span>
  );
}

function RankingSkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-16 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
        />
      ))}
    </div>
  );
}

function RankingState({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof Trophy;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-slate-500" />
      <p className="mt-3 text-sm font-black text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function itemLabel(item: ChampionshipTeamRankingItem | ChampionshipTopScorerRankingItem) {
  if ("playerId" in item) return item.playerName || item.playerId;
  return item.teamName || item.teamId || item.registrationId;
}

function itemMeta(item: ChampionshipTeamRankingItem | ChampionshipTopScorerRankingItem) {
  if ("playerId" in item) {
    return `${item.teamName || "Sem equipe"} - ${item.goals} gol(s), ${item.matches} jogo(s)`;
  }

  if (typeof item.fairPlayScore === "number") {
    return `${item.fairPlayScore} ponto(s), ${item.yellowCards} CA, ${item.redCards} CV`;
  }

  return `${item.goalsFor} GP, ${item.goalsAgainst} GC, ${item.goalDifference} SG`;
}

function itemKey(item: ChampionshipTeamRankingItem | ChampionshipTopScorerRankingItem) {
  if ("playerId" in item) return item.playerId;
  return item.registrationId;
}
