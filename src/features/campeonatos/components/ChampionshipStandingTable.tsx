import { BarChart3, Rows3, Table2, Trophy } from "lucide-react";

import { getStandingTieBreakerLabel } from "../utils/championship-formatters";

import type {
  ChampionshipStanding,
  ChampionshipStandingGroup,
  ChampionshipStandingTieBreaker,
} from "../types/championship.types";

export type ChampionshipStandingViewMode = "overall" | "groups";

type ChampionshipStandingTableProps = {
  criteria: ChampionshipStandingTieBreaker[];
  groups: ChampionshipStandingGroup[];
  items: ChampionshipStanding[];
  onViewModeChange: (mode: ChampionshipStandingViewMode) => void;
  viewMode: ChampionshipStandingViewMode;
};

export function ChampionshipStandingTable({
  criteria,
  groups,
  items,
  onViewModeChange,
  viewMode,
}: ChampionshipStandingTableProps) {
  const groupedItems = normalizeGroups(groups, items);

  if (items.length === 0 && groupedItems.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-slate-500" />
        <p className="mt-3 text-sm font-black text-white">Classificacao sem equipes</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Vincule equipes aos grupos e registre resultados de jogos para preencher a tabela.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <ViewModeButton
            active={viewMode === "overall"}
            icon={Table2}
            label="Geral"
            onClick={() => onViewModeChange("overall")}
          />
          <ViewModeButton
            active={viewMode === "groups"}
            icon={Rows3}
            label="Por grupo"
            onClick={() => onViewModeChange("groups")}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {criteria.map((criterion, index) => (
            <span
              key={`${criterion}-${index}`}
              className="inline-flex min-h-8 items-center rounded-full border border-white/10 bg-white/[0.03] px-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400"
            >
              {index + 1}. {getStandingTieBreakerLabel(criterion)}
            </span>
          ))}
        </div>
      </div>

      {viewMode === "groups" ? (
        <div className="grid gap-4">
          {groupedItems.map((group) => (
            <section
              key={group.groupId || group.groupName || "grupo"}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-black text-white">{group.groupName || "Grupo"}</h3>
                </div>
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {group.total} equipe(s)
                </span>
              </div>
              <StandingTableRows items={group.items} mode="group" />
            </section>
          ))}
        </div>
      ) : (
        <StandingTableRows items={items} mode="overall" />
      )}
    </div>
  );
}

function StandingTableRows({
  items,
  mode,
}: {
  items: ChampionshipStanding[];
  mode: ChampionshipStandingViewMode;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[760px] border-collapse bg-black/20 text-left text-sm">
        <thead className="bg-white/[0.03] text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-3">#</th>
            <th className="px-3 py-3">Equipe</th>
            {mode === "overall" ? <th className="px-3 py-3">Grupo</th> : null}
            <th className="px-3 py-3 text-right">PTS</th>
            <th className="px-3 py-3 text-right">J</th>
            <th className="px-3 py-3 text-right">V</th>
            <th className="px-3 py-3 text-right">E</th>
            <th className="px-3 py-3 text-right">D</th>
            <th className="px-3 py-3 text-right">GP</th>
            <th className="px-3 py-3 text-right">GC</th>
            <th className="px-3 py-3 text-right">SG</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const position = mode === "overall" ? item.overallPosition : item.groupPosition;

            return (
              <tr
                key={`${item.groupId}:${item.registrationId}`}
                className="border-t border-white/10 text-slate-200"
              >
                <td className="px-3 py-3">
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-2 text-xs font-black text-primary">
                    {position || item.position}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-white">
                      {item.teamName || item.teamId || item.registrationId}
                    </p>
                    {item.teamAcronym ? (
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        {item.teamAcronym}
                      </p>
                    ) : null}
                  </div>
                </td>
                {mode === "overall" ? (
                  <td className="px-3 py-3 text-slate-400">{item.groupName || "-"}</td>
                ) : null}
                <NumericCell value={item.points} strong />
                <NumericCell value={item.played} />
                <NumericCell value={item.wins} />
                <NumericCell value={item.draws} />
                <NumericCell value={item.losses} />
                <NumericCell value={item.goalsFor} />
                <NumericCell value={item.goalsAgainst} />
                <NumericCell value={item.goalDifference} signed />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NumericCell({
  signed = false,
  strong = false,
  value,
}: {
  signed?: boolean;
  strong?: boolean;
  value: number;
}) {
  const text = signed && value > 0 ? `+${value}` : String(value);

  return (
    <td className={`px-3 py-3 text-right tabular-nums ${strong ? "font-black text-white" : ""}`}>
      {text}
    </td>
  );
}

function ViewModeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Table2;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black transition ${
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function normalizeGroups(
  groups: ChampionshipStandingGroup[],
  items: ChampionshipStanding[],
): ChampionshipStandingGroup[] {
  if (groups.length > 0) return groups;

  const grouped = new Map<string, ChampionshipStandingGroup>();

  for (const item of items) {
    const groupId = item.groupId || "grupo";
    const current = grouped.get(groupId) || {
      groupDisplayOrder: item.groupDisplayOrder || 0,
      groupId,
      groupName: item.groupName || "Grupo",
      items: [],
      total: 0,
    };

    current.items.push(item);
    current.total = current.items.length;
    grouped.set(groupId, current);
  }

  return Array.from(grouped.values()).sort(
    (left, right) =>
      Number(left.groupDisplayOrder || 0) - Number(right.groupDisplayOrder || 0) ||
      String(left.groupName || "").localeCompare(String(right.groupName || "")),
  );
}
