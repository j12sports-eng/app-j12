import {
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

import {
  formatChampionshipDate,
  formatChampionshipDateTime,
  getMatchStatusLabel,
  getMatchStatusTone,
} from "../utils/championship-formatters";

import type {
  PublicBracket,
  PublicBracketPhase,
  PublicGroup,
  PublicMatch,
  PublicPlayerStatistics,
  PublicStanding,
  PublicStandingResponse,
  PublicStatisticsResponse,
  PublicTeam,
  PublicTeamStatistics,
  PublicTopScorersResponse,
} from "../types/championship-public.types";

type PublicGroupsViewProps = {
  groups: PublicGroup[];
  isLoading?: boolean;
  teams: PublicTeam[];
};

type PublicMatchesTableProps = {
  isLoading?: boolean;
  matches: PublicMatch[];
};

type PublicStandingsTableProps = {
  isLoading?: boolean;
  standings?: PublicStandingResponse;
};

type PublicBracketViewProps = {
  bracket?: PublicBracket | null;
  isLoading?: boolean;
};

type PublicStatisticsViewProps = {
  isLoading?: boolean;
  statistics?: PublicStatisticsResponse;
};

type PublicTopScorersTableProps = {
  isLoading?: boolean;
  topScorers?: PublicTopScorersResponse;
};

const BRACKET_PHASE_LABELS: Record<string, string> = {
  FINAL: "Final",
  QUARTER_FINAL: "Quartas",
  ROUND_OF_16: "Oitavas",
  ROUND_OF_32: "32 avos",
  SEMI_FINAL: "Semifinal",
  THIRD_PLACE: "3o lugar",
};

export function ChampionshipPublicGroupsView({ groups, isLoading, teams }: PublicGroupsViewProps) {
  if (isLoading) return <PublicLoadingGrid />;

  if (groups.length === 0 && teams.length === 0) {
    return <PublicEmptyState icon={UsersRound} title="Nenhuma equipe publicada" />;
  }

  if (groups.length === 0) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <PublicTeamCard key={team.registrationId || team.teamId || team.teamName} team={team} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <section
          key={group.id || group.name}
          className="rounded-lg border border-white/10 bg-[#111114] p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-white">{group.name || "Grupo"}</h3>
              <p className="text-sm text-slate-400">{group.totalTeams} equipes</p>
            </div>
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">
              #{group.displayOrder || 1}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {group.teams.map((team) => (
              <div
                key={team.registrationId || team.teamId || team.teamName}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-white">
                    {team.teamName || "Equipe"}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {team.acronym || "Sem sigla"}
                  </span>
                </span>
                {team.drawPosition ? (
                  <span className="text-xs font-bold text-slate-400">Pote {team.drawPosition}</span>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ChampionshipPublicMatchesTable({ isLoading, matches }: PublicMatchesTableProps) {
  if (isLoading) return <PublicLoadingRows />;

  if (matches.length === 0) {
    return <PublicEmptyState icon={CalendarDays} title="Nenhum jogo publicado" />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-[#111114]">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Jogo</th>
              <th className="px-4 py-3">Placar</th>
              <th className="px-4 py-3">Grupo</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {matches.map((match) => (
              <tr key={match.id || `${match.home.registrationId}-${match.away.registrationId}`}>
                <td className="px-4 py-3 text-slate-300">{formatMatchDate(match)}</td>
                <td className="px-4 py-3">
                  <span className="font-black text-white">{getMatchTeamName(match.home)}</span>
                  <span className="mx-2 text-slate-600">x</span>
                  <span className="font-black text-white">{getMatchTeamName(match.away)}</span>
                </td>
                <td className="px-4 py-3 text-base font-black text-primary">
                  {formatScore(match.score.home, match.score.away)}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {match.groupName || match.roundName || "-"}
                </td>
                <td className="px-4 py-3">
                  <PublicStatusBadge status={match.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-white/10 md:hidden">
        {matches.map((match) => (
          <article
            key={match.id || `${match.home.registrationId}-${match.away.registrationId}`}
            className="p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-500">{formatMatchDate(match)}</span>
              <PublicStatusBadge status={match.status} />
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <TeamNameBlock label={getMatchTeamName(match.home)} acronym={match.home.acronym} />
              <span className="text-lg font-black text-primary">
                {formatScore(match.score.home, match.score.away)}
              </span>
              <TeamNameBlock
                align="right"
                label={getMatchTeamName(match.away)}
                acronym={match.away.acronym}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {match.groupName || match.roundName || "-"}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function ChampionshipPublicStandingsTable({
  isLoading,
  standings,
}: PublicStandingsTableProps) {
  if (isLoading) return <PublicLoadingRows />;

  const groups = standings?.groups || [];
  const items = standings?.items || [];

  if (groups.length === 0 && items.length === 0) {
    return <PublicEmptyState icon={BarChart3} title="Classificacao indisponivel" />;
  }

  if (groups.length > 0) {
    return (
      <div className="space-y-4">
        {groups.map((group) => (
          <section key={group.groupId || group.groupName} className="space-y-3">
            <h3 className="text-base font-black text-white">{group.groupName || "Grupo"}</h3>
            <StandingTableRows items={group.items} />
          </section>
        ))}
      </div>
    );
  }

  return <StandingTableRows items={items} />;
}

export function ChampionshipPublicBracketView({ bracket, isLoading }: PublicBracketViewProps) {
  if (isLoading) return <PublicLoadingGrid />;

  if (!bracket || bracket.matches.length === 0) {
    return <PublicEmptyState icon={Swords} title="Mata-mata indisponivel" />;
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[760px] gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {bracket.phases.map((phase) => (
          <section
            key={phase.phase || "fase"}
            className="rounded-lg border border-white/10 bg-[#111114] p-4"
          >
            <h3 className="text-sm font-black uppercase tracking-[0.12em] text-primary">
              {getBracketPhaseLabel(phase.phase)}
            </h3>
            <div className="mt-4 space-y-3">
              {phase.matches.map((match) => (
                <article
                  key={match.id || `${match.home.registrationId}-${match.away.registrationId}`}
                  className="rounded-lg border border-white/10 bg-black/30 p-3"
                >
                  <BracketTeamRow
                    isWinner={match.winnerRegistrationId === match.home.registrationId}
                    score={match.score.home}
                    teamName={getMatchTeamName(match.home)}
                  />
                  <BracketTeamRow
                    isWinner={match.winnerRegistrationId === match.away.registrationId}
                    score={match.score.away}
                    teamName={getMatchTeamName(match.away)}
                  />
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{formatMatchDate(match)}</span>
                    <PublicStatusBadge status={match.status} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function ChampionshipPublicStatisticsView({
  isLoading,
  statistics,
}: PublicStatisticsViewProps) {
  if (isLoading) return <PublicLoadingGrid />;

  const summary = statistics?.championship;

  if (!summary && !statistics) {
    return <PublicEmptyState icon={BarChart3} title="Estatisticas indisponiveis" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PublicMetric icon={CalendarDays} label="Jogos" value={summary?.matchesPlayed || 0} />
        <PublicMetric icon={Goal} label="Gols" value={summary?.goalsScored || 0} />
        <PublicMetric
          icon={BarChart3}
          label="Media de gols"
          value={formatDecimal(summary?.goalsAverage || 0)}
        />
        <PublicMetric
          icon={Shield}
          label="Cartoes"
          value={(summary?.yellowCards || 0) + (summary?.redCards || 0)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RankingCard title="Melhor ataque" teams={statistics?.rankings.bestAttack || []} />
        <RankingCard title="Melhor defesa" teams={statistics?.rankings.bestDefense || []} />
        <RankingCard title="Fair play" teams={statistics?.rankings.fairPlay || []} />
      </div>
    </div>
  );
}

export function ChampionshipPublicTopScorersTable({
  isLoading,
  topScorers,
}: PublicTopScorersTableProps) {
  if (isLoading) return <PublicLoadingRows />;

  const items = topScorers?.items || [];

  if (items.length === 0) {
    return <PublicEmptyState icon={Medal} title="Artilharia indisponivel" />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#111114]">
      <table className="min-w-full divide-y divide-white/10 text-left text-sm">
        <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Atleta</th>
            <th className="px-4 py-3">Equipe</th>
            <th className="px-4 py-3">Gols</th>
            <th className="px-4 py-3">Jogos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {items.map((player) => (
            <TopScorerRow
              key={player.playerId || `${player.playerName}-${player.teamName}`}
              player={player}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PublicTeamCard({ team }: { team: PublicTeam }) {
  return (
    <article className="rounded-lg border border-white/10 bg-[#111114] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black">
          {team.logo?.publicUrl ? (
            <img
              src={team.logo.publicUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <Shield className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black text-white">{team.teamName || "Equipe"}</h3>
          <p className="text-xs text-slate-500">{team.acronym || team.city || "J12"}</p>
        </div>
      </div>
      {team.coach ? (
        <p className="mt-3 text-xs font-semibold text-slate-400">Tecnico: {team.coach}</p>
      ) : null}
    </article>
  );
}

function StandingTableRows({ items }: { items: PublicStanding[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#111114]">
      <table className="min-w-full divide-y divide-white/10 text-left text-sm">
        <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Pos</th>
            <th className="px-4 py-3">Equipe</th>
            <th className="px-4 py-3">P</th>
            <th className="px-4 py-3">J</th>
            <th className="px-4 py-3">V</th>
            <th className="px-4 py-3">E</th>
            <th className="px-4 py-3">D</th>
            <th className="px-4 py-3">SG</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {items.map((item) => (
            <tr key={item.team.registrationId || item.team.teamName}>
              <td className="px-4 py-3 font-black text-primary">
                {item.position || item.overallPosition}
              </td>
              <td className="px-4 py-3">
                <span className="block font-black text-white">
                  {item.team.teamName || "Equipe"}
                </span>
                <span className="block text-xs text-slate-500">{item.team.acronym || "-"}</span>
              </td>
              <td className="px-4 py-3 font-black text-white">{item.points}</td>
              <td className="px-4 py-3 text-slate-300">{item.played}</td>
              <td className="px-4 py-3 text-slate-300">{item.wins}</td>
              <td className="px-4 py-3 text-slate-300">{item.draws}</td>
              <td className="px-4 py-3 text-slate-300">{item.losses}</td>
              <td className="px-4 py-3 text-slate-300">{item.goalDifference}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankingCard({ teams, title }: { teams: PublicTeamStatistics[]; title: string }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111114] p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.12em] text-primary">{title}</h3>
      <div className="mt-4 space-y-2">
        {teams.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum dado publicado.</p>
        ) : (
          teams.slice(0, 5).map((team) => (
            <div
              key={team.registrationId || team.teamName}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
            >
              <span className="truncate font-bold text-white">{team.teamName || "Equipe"}</span>
              <span className="font-black text-primary">
                {title === "Fair play" ? team.yellowCards + team.redCards : team.goalsFor}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function TopScorerRow({ player }: { player: PublicPlayerStatistics }) {
  return (
    <tr>
      <td className="px-4 py-3 font-black text-primary">{player.position}</td>
      <td className="px-4 py-3">
        <span className="block font-black text-white">{player.playerName || "Atleta"}</span>
        <span className="block text-xs text-slate-500">
          {player.shirtNumber ? `Camisa ${player.shirtNumber}` : "Sem numero"}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-300">{player.teamName || "-"}</td>
      <td className="px-4 py-3 text-base font-black text-primary">{player.goals}</td>
      <td className="px-4 py-3 text-slate-300">{player.matches}</td>
    </tr>
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
    <div className="rounded-lg border border-white/10 bg-[#111114] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function BracketTeamRow({
  isWinner,
  score,
  teamName,
}: {
  isWinner: boolean;
  score: number | null;
  teamName: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm ${
        isWinner ? "bg-primary/10 text-primary" : "text-slate-300"
      }`}
    >
      <span className="truncate font-bold">{teamName}</span>
      <span className="font-black">{score ?? "-"}</span>
    </div>
  );
}

function TeamNameBlock({
  acronym,
  align = "left",
  label,
}: {
  acronym?: string | null;
  align?: "left" | "right";
  label: string;
}) {
  return (
    <span className={align === "right" ? "min-w-0 text-right" : "min-w-0"}>
      <span className="block truncate text-sm font-black text-white">{label}</span>
      <span className="block truncate text-xs text-slate-500">{acronym || "-"}</span>
    </span>
  );
}

function PublicStatusBadge({ status }: { status: PublicMatch["status"] }) {
  const normalizedStatus = status || "SCHEDULED";

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-black ${getMatchStatusTone(
        normalizedStatus,
      )}`}
    >
      {getMatchStatusLabel(normalizedStatus)}
    </span>
  );
}

function PublicEmptyState({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-[#111114] p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-primary" />
      <p className="mt-3 text-sm font-black text-white">{title}</p>
    </div>
  );
}

function PublicLoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-40 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

function PublicLoadingRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-14 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

function getMatchTeamName(team: { acronym: string | null; teamName: string | null }) {
  return team.teamName || team.acronym || "Equipe";
}

function getBracketPhaseLabel(phase: PublicBracketPhase | null) {
  if (!phase) return "Fase";
  return BRACKET_PHASE_LABELS[phase] || phase;
}

function formatScore(home: number | null, away: number | null) {
  if (home === null && away === null) return "x";
  return `${home ?? 0} x ${away ?? 0}`;
}

function formatMatchDate(match: { matchDate: string | null; startTime: string | null }) {
  if (match.matchDate && match.startTime) {
    return `${formatChampionshipDate(match.matchDate)} - ${match.startTime.slice(0, 5)}`;
  }

  return formatChampionshipDateTime(match.matchDate) || "-";
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}
