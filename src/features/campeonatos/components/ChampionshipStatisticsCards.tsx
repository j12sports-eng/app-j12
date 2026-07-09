import { BadgeAlert, BarChart3, Goal, ShieldAlert, Trophy } from "lucide-react";

import type { ChampionshipStatisticsSummary } from "../types/championship.types";

type ChampionshipStatisticsCardsProps = {
  statistics: ChampionshipStatisticsSummary | null;
};

export function ChampionshipStatisticsCards({ statistics }: ChampionshipStatisticsCardsProps) {
  const cards = [
    {
      icon: Trophy,
      label: "Jogos",
      value: statistics?.matchesPlayed ?? 0,
    },
    {
      icon: BarChart3,
      label: "Finalizados",
      value: statistics?.finishedMatches ?? 0,
    },
    {
      icon: Goal,
      label: "Gols",
      value: statistics?.goalsScored ?? 0,
    },
    {
      icon: BarChart3,
      label: "Media de gols",
      value: formatDecimal(statistics?.goalsAverage ?? 0),
    },
    {
      icon: BadgeAlert,
      label: "Cartoes amarelos",
      value: statistics?.yellowCards ?? 0,
    },
    {
      icon: ShieldAlert,
      label: "Cartoes vermelhos",
      value: statistics?.redCards ?? 0,
    },
    {
      icon: Trophy,
      label: "W.O.",
      value: statistics?.walkovers ?? 0,
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="rounded-2xl border border-white/10 bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-black text-white">{card.value}</p>
            </div>
            <card.icon className="h-5 w-5 shrink-0 text-primary" />
          </div>
        </article>
      ))}
    </section>
  );
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}
