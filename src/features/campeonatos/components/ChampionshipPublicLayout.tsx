import { type ReactNode } from "react";
import { ListFilter, Shield, Trophy } from "lucide-react";

import logoUrl from "@/assets/logo.png?url";

type ChampionshipPublicLayoutProps = {
  children: ReactNode;
  eyebrow?: string;
  subtitle?: string;
  title: string;
};

export function ChampionshipPublicLayout({
  children,
  eyebrow = "J12 Sports",
  subtitle,
  title,
}: ChampionshipPublicLayoutProps) {
  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <header className="border-b border-white/10 bg-black/90">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <a href="/campeonatos" className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <img src={logoUrl} alt="J12" className="h-8 w-8 object-contain" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
                <Trophy className="h-4 w-4" />
                {eyebrow}
              </span>
              <span className="mt-1 block truncate text-lg font-black text-white">{title}</span>
            </span>
          </a>

          <nav className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-300">
            <a
              href="/campeonatos"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-primary transition hover:bg-primary/20"
            >
              <ListFilter className="h-4 w-4" />
              Campeonatos
            </a>
            <a
              href="/login"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-slate-200 transition hover:bg-white/10"
            >
              <Shield className="h-4 w-4" />
              Area restrita
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {subtitle ? <p className="mb-5 max-w-3xl text-sm leading-6 text-slate-400">{subtitle}</p> : null}
        {children}
      </main>
    </div>
  );
}
