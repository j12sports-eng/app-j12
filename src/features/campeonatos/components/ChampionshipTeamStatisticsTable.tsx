import { AlertTriangle, Shield } from "lucide-react";

import { ChampionshipStatisticsPagination } from "./ChampionshipStatisticsFilters";

import type { ChampionshipTeamStatistics } from "../types/championship.types";

type ChampionshipTeamStatisticsTableProps = {
  errorMessage?: string;
  isLoading?: boolean;
  items: ChampionshipTeamStatistics[];
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  total: number;
};

export function ChampionshipTeamStatisticsTable({
  errorMessage = "",
  isLoading = false,
  items,
  onPageChange,
  page,
  pageSize,
  total,
}: ChampionshipTeamStatisticsTableProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-card">
      <div className="p-5">
        <h3 className="text-lg font-black text-white">Estatisticas por equipe</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Jogos, resultados, gols, saldo, aproveitamento, cartoes e W.O.
        </p>
      </div>

      {errorMessage ? (
        <TableState icon={AlertTriangle} title="Falha ao carregar equipes" text={errorMessage} />
      ) : isLoading ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <TableState
          icon={Shield}
          title="Nenhuma equipe encontrada"
          text="Nao ha estatisticas de equipes dentro dos filtros atuais."
        />
      ) : (
        <>
          <div className="overflow-x-auto border-t border-white/10">
            <table className="w-full min-w-[980px] border-collapse bg-black/20 text-left text-sm">
              <thead className="bg-white/[0.03] text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Equipe</th>
                  <th className="px-3 py-3 text-right">J</th>
                  <th className="px-3 py-3 text-right">V</th>
                  <th className="px-3 py-3 text-right">E</th>
                  <th className="px-3 py-3 text-right">D</th>
                  <th className="px-3 py-3 text-right">GP</th>
                  <th className="px-3 py-3 text-right">GC</th>
                  <th className="px-3 py-3 text-right">SG</th>
                  <th className="px-3 py-3 text-right">Aproveit.</th>
                  <th className="px-3 py-3">Sequencia</th>
                  <th className="px-3 py-3 text-right">CA</th>
                  <th className="px-3 py-3 text-right">CV</th>
                  <th className="px-3 py-3 text-right">W.O.</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.registrationId} className="border-t border-white/10 text-slate-200">
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
                    <NumericCell value={item.matches} />
                    <NumericCell value={item.wins} />
                    <NumericCell value={item.draws} />
                    <NumericCell value={item.losses} />
                    <NumericCell value={item.goalsFor} />
                    <NumericCell value={item.goalsAgainst} />
                    <NumericCell signed value={item.goalDifference} strong />
                    <NumericCell suffix="%" value={item.performance} />
                    <td className="px-3 py-3">
                      <ResultStreak values={item.resultStreak} />
                    </td>
                    <NumericCell value={item.yellowCards} />
                    <NumericCell value={item.redCards} />
                    <NumericCell value={item.walkovers} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ChampionshipStatisticsPagination
            onPageChange={onPageChange}
            page={page}
            pageSize={pageSize}
            total={total}
          />
        </>
      )}
    </section>
  );
}

function ResultStreak({ values }: { values: string[] }) {
  if (!values.length) return <span className="text-slate-500">-</span>;

  return (
    <span className="inline-flex max-w-[220px] flex-wrap gap-1">
      {values.slice(-5).map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-2 text-[11px] font-black text-white"
        >
          {value}
        </span>
      ))}
    </span>
  );
}

function NumericCell({
  signed = false,
  strong = false,
  suffix = "",
  value,
}: {
  signed?: boolean;
  strong?: boolean;
  suffix?: string;
  value: number;
}) {
  const normalized = signed && value > 0 ? `+${formatNumber(value)}` : formatNumber(value);

  return (
    <td className={`px-3 py-3 text-right tabular-nums ${strong ? "font-black text-white" : ""}`}>
      {normalized}
      {suffix}
    </td>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

function TableSkeleton() {
  return (
    <div className="grid gap-2 border-t border-white/10 p-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-xl bg-white/[0.03]" />
      ))}
    </div>
  );
}

function TableState({
  icon: Icon,
  text,
  title,
}: {
  icon: typeof Shield;
  text: string;
  title: string;
}) {
  return (
    <div className="border-t border-white/10 p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-slate-500" />
      <p className="mt-3 text-sm font-black text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}
