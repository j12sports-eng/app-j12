import { Goal, ShieldCheck, ShieldMinus, Trophy } from "lucide-react";

import type { ChampionshipRankings } from "../types/championship.types";

type ChampionshipStatisticsSummaryProps = {
  rankings: ChampionshipRankings | null;
};

export function ChampionshipStatisticsSummary({ rankings }: ChampionshipStatisticsSummaryProps) {
  const topScorer = rankings?.topScorers?.[0] || null;
  const bestAttack = rankings?.bestAttack?.[0] || null;
  const bestDefense = rankings?.bestDefense?.[0] || null;
  const fairPlay = rankings?.fairPlay?.[0] || null;

  const items = [
    {
      icon: Trophy,
      label: "Artilharia",
      meta: topScorer ? `${topScorer.goals} gol(s)` : "-",
      value: topScorer?.playerName || "Sem gols",
    },
    {
      icon: Goal,
      label: "Melhor ataque",
      meta: bestAttack ? `${bestAttack.goalsFor} GP` : "-",
      value: bestAttack?.teamName || "Sem jogos",
    },
    {
      icon: ShieldMinus,
      label: "Melhor defesa",
      meta: bestDefense ? `${bestDefense.goalsAgainst} GC` : "-",
      value: bestDefense?.teamName || "Sem jogos",
    },
    {
      icon: ShieldCheck,
      label: "Fair play",
      meta: fairPlay ? `${fairPlay.fairPlayScore ?? 0} pts` : "-",
      value: fairPlay?.teamName || "Sem equipes",
    },
  ];

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.label} className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                {item.label}
              </p>
              <p className="mt-1 truncate text-sm font-black text-white">{item.value}</p>
              <p className="mt-1 text-xs font-semibold text-primary">{item.meta}</p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
