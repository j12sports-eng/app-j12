import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Goal,
  Medal,
  Shield,
  Swords,
  Trophy,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode } from "react";

import { formatApiErrorMessage } from "@/lib/api";

import {
  ChampionshipPublicBracketView,
  ChampionshipPublicGroupsView,
  ChampionshipPublicLayout,
  ChampionshipPublicMatchesTable,
  ChampionshipPublicStandingsTable,
  ChampionshipPublicStatisticsView,
  ChampionshipPublicTopScorersTable,
} from "../components";
import {
  usePublicChampionship,
  usePublicChampionshipBracket,
  usePublicChampionshipGroups,
  usePublicChampionshipMatches,
  usePublicChampionshipStandings,
  usePublicChampionshipStatistics,
  usePublicChampionshipTeams,
  usePublicChampionshipTopScorers,
} from "../hooks/usePublicChampionships";
import { formatChampionshipDate } from "../utils/championship-formatters";

import type { PublicChampionship } from "../types/championship-public.types";

type ChampionshipPublicDetailsPageProps = {
  championshipId: string;
};

const PUBLIC_DETAIL_LIMIT = 100;
const PUBLIC_TOP_SCORERS_LIMIT = 50;

export function ChampionshipPublicDetailsPage({
  championshipId,
}: ChampionshipPublicDetailsPageProps) {
  return (
    <ChampionshipPublicLayout
      eyebrow="Campeonato publicado"
      title="Detalhes do Campeonato"
      subtitle="Dados publicos sincronizados com o modulo administrativo de campeonatos."
    >
      <ChampionshipPublicDetailsContent championshipId={championshipId} />
    </ChampionshipPublicLayout>
  );
}

function ChampionshipPublicDetailsContent({ championshipId }: ChampionshipPublicDetailsPageProps) {
  const pagination = { limit: PUBLIC_DETAIL_LIMIT };

  // Mantem o portal publico somente leitura: todas as chamadas abaixo sao queries.
  const championshipQuery = usePublicChampionship(championshipId);
  const groupsQuery = usePublicChampionshipGroups(championshipId, pagination);
  const teamsQuery = usePublicChampionshipTeams(championshipId, pagination);
  const matchesQuery = usePublicChampionshipMatches(championshipId, pagination);
  const standingsQuery = usePublicChampionshipStandings(championshipId, pagination);
  const bracketQuery = usePublicChampionshipBracket(championshipId);
  const statisticsQuery = usePublicChampionshipStatistics(championshipId, pagination);
  const topScorersQuery = usePublicChampionshipTopScorers(championshipId, {
    limit: PUBLIC_TOP_SCORERS_LIMIT,
  });

  const championship = championshipQuery.data || null;
  const groups = groupsQuery.data?.items || [];
  const teams = teamsQuery.data?.items || [];
  const matches = matchesQuery.data?.items || [];
  const statistics = statisticsQuery.data;
  const topScorers = topScorersQuery.data;
  const goals = statistics?.championship?.goalsScored || 0;
  const finishedMatches = statistics?.championship?.finishedMatches || 0;
  const detailError = championshipQuery.error
    ? formatApiErrorMessage(championshipQuery.error, "Campeonato publico indisponivel.")
    : "";
  const dataError = [
    groupsQuery.error,
    teamsQuery.error,
    matchesQuery.error,
    standingsQuery.error,
    bracketQuery.error,
    statisticsQuery.error,
    topScorersQuery.error,
  ].find(Boolean);

  if (championshipQuery.isLoading && !championship) {
    return <PublicDetailsSkeleton />;
  }

  if (!championship) {
    return (
      <PublicDetailsMessage
        icon={AlertTriangle}
        title="Campeonato nao encontrado"
        description={detailError || "Este campeonato nao esta publicado ou nao existe."}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(255,69,0,0.18),rgba(17,17,20,0.98))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] md:p-6">
        <a
          href="/campeonatos"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-black text-slate-200 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </a>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <ChampionshipIdentity championship={championship} />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[620px]">
            <PublicMetric
              icon={UsersRound}
              label="Equipes"
              value={teamsQuery.data?.total ?? teams.length}
            />
            <PublicMetric
              icon={CalendarDays}
              label="Jogos"
              value={matchesQuery.data?.total ?? matches.length}
            />
            <PublicMetric icon={Goal} label="Gols" value={goals} />
            <PublicMetric icon={Trophy} label="Finalizados" value={finishedMatches} />
          </div>
        </div>
      </section>

      {dataError ? (
        <PublicWarningMessage
          message={formatApiErrorMessage(dataError, "Alguns dados publicos nao foram carregados.")}
        />
      ) : null}

      <PublicSectionNav />

      <PublicSection
        id="grupos"
        icon={UsersRound}
        title="Grupos"
        description="Distribuicao publica das equipes por grupo."
      >
        <ChampionshipPublicGroupsView
          groups={groups}
          isLoading={groupsQuery.isLoading}
          teams={teams}
        />
      </PublicSection>

      <PublicSection
        id="equipes"
        icon={Shield}
        title="Equipes"
        description="Equipes publicadas para este campeonato."
      >
        <ChampionshipPublicGroupsView groups={[]} isLoading={teamsQuery.isLoading} teams={teams} />
      </PublicSection>

      <PublicSection
        id="jogos"
        icon={CalendarDays}
        title="Jogos"
        description="Agenda e resultados publicados."
      >
        <ChampionshipPublicMatchesTable isLoading={matchesQuery.isLoading} matches={matches} />
      </PublicSection>

      <PublicSection
        id="classificacao"
        icon={BarChart3}
        title="Classificacao"
        description="Tabela publica por grupos ou geral."
      >
        <ChampionshipPublicStandingsTable
          isLoading={standingsQuery.isLoading}
          standings={standingsQuery.data}
        />
      </PublicSection>

      <PublicSection
        id="mata-mata"
        icon={Swords}
        title="Mata-mata"
        description="Chave eliminatoria publicada."
      >
        <ChampionshipPublicBracketView
          bracket={bracketQuery.data}
          isLoading={bracketQuery.isLoading}
        />
      </PublicSection>

      <PublicSection
        id="estatisticas"
        icon={BarChart3}
        title="Estatisticas"
        description="Resumo de desempenho e rankings publicos."
      >
        <ChampionshipPublicStatisticsView
          isLoading={statisticsQuery.isLoading}
          statistics={statistics}
        />
      </PublicSection>

      <PublicSection
        id="artilharia"
        icon={Medal}
        title="Artilharia"
        description="Ranking publico de atletas por gols."
      >
        <ChampionshipPublicTopScorersTable
          isLoading={topScorersQuery.isLoading}
          topScorers={topScorers}
        />
      </PublicSection>
    </div>
  );
}

function ChampionshipIdentity({ championship }: { championship: PublicChampionship }) {
  const logoUrl = championship.logo?.publicUrl || "";

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Trophy className="h-10 w-10 text-primary" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex min-h-8 items-center rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2.5 text-xs font-black uppercase tracking-[0.14em] text-emerald-100">
            Publicado
          </span>
          <span className="inline-flex min-h-8 items-center rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-xs font-bold text-slate-300">
            {[championship.category, championship.modality].filter(Boolean).join(" - ") || "J12"}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-black leading-tight text-white md:text-5xl">
          {championship.name || "Campeonato"}
        </h1>
        <p className="mt-2 text-sm font-semibold text-slate-400">
          {formatChampionshipDate(championship.startDate)} ate{" "}
          {formatChampionshipDate(championship.endDate)}
        </p>
        {championship.description ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {championship.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PublicSectionNav() {
  const items = [
    { href: "#grupos", icon: UsersRound, label: "Grupos" },
    { href: "#equipes", icon: Shield, label: "Equipes" },
    { href: "#jogos", icon: CalendarDays, label: "Jogos" },
    { href: "#classificacao", icon: BarChart3, label: "Classificacao" },
    { href: "#mata-mata", icon: Swords, label: "Mata-mata" },
    { href: "#estatisticas", icon: BarChart3, label: "Estatisticas" },
    { href: "#artilharia", icon: Medal, label: "Artilharia" },
  ];

  return (
    <nav
      aria-label="Navegacao dos dados publicos do campeonato"
      className="flex gap-2 overflow-x-auto rounded-lg border border-white/10 bg-[#111114] p-2"
    >
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 text-sm font-black text-slate-200 transition hover:border-primary/40 hover:text-primary"
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </a>
      ))}
    </nav>
  );
}

function PublicSection({
  children,
  description,
  icon: Icon,
  id,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: LucideIcon;
  id: string;
  title: string;
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Icon className="h-5 w-5" />
            <h2 className="text-xl font-black text-white">{title}</h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function PublicMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-black/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 truncate text-xl font-black text-white">{value}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-primary" />
      </div>
    </article>
  );
}

function PublicWarningMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-bold">Dados parcialmente carregados.</p>
        <p className="mt-1 text-amber-100/80">{message}</p>
      </div>
    </div>
  );
}

function PublicDetailsMessage({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-dashed border-white/15 bg-[#111114] p-8 text-center">
      <Icon className="mx-auto h-9 w-9 text-primary" />
      <h1 className="mt-3 text-xl font-black text-white">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      <a
        href="/campeonatos"
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary px-4 text-sm font-black text-black transition hover:bg-primary/90"
      >
        <ArrowLeft className="h-4 w-4" />
        Ver campeonatos
      </a>
    </section>
  );
}

function PublicDetailsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="h-72 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]" />
      <div className="h-16 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]" />
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-52 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

export { ChampionshipPublicDetailsContent };
