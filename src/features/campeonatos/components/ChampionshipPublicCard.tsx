import { ArrowRight, CalendarDays, Shield, Trophy } from "lucide-react";

import { formatChampionshipDate } from "../utils/championship-formatters";

import type { PublicChampionship } from "../types/championship-public.types";

type ChampionshipPublicCardProps = {
  championship: PublicChampionship;
};

export function ChampionshipPublicCard({ championship }: ChampionshipPublicCardProps) {
  const logoUrl = championship.logo?.publicUrl || "";
  const detailHref = `/campeonatos/${encodeURIComponent(championship.id)}`;

  return (
    <article className="group flex h-full flex-col rounded-lg border border-white/10 bg-[#111114] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.28)] transition hover:border-primary/40 hover:bg-[#151518]">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <Trophy className="h-7 w-7 text-primary" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-lg font-black leading-tight text-white">
            {championship.name || "Campeonato"}
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-400">
            {[championship.category, championship.modality].filter(Boolean).join(" - ") || "J12"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex min-h-8 items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2.5 text-xs font-black uppercase tracking-[0.14em] text-emerald-100">
          <Shield className="h-3.5 w-3.5" />
          Publicado
        </span>
        <span className="inline-flex min-h-8 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-xs font-bold text-slate-300">
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          {formatChampionshipDate(championship.startDate)} ate{" "}
          {formatChampionshipDate(championship.endDate)}
        </span>
      </div>

      {championship.description ? (
        <p className="mt-4 line-clamp-3 flex-1 text-sm leading-6 text-slate-400">
          {championship.description}
        </p>
      ) : (
        <div className="mt-4 flex-1" />
      )}

      <a
        href={detailHref}
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary px-4 text-sm font-black text-black transition hover:bg-primary/90"
      >
        Ver campeonato
        <ArrowRight className="h-4 w-4" />
      </a>
    </article>
  );
}
