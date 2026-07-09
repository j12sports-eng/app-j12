import { AlertTriangle, UsersRound } from "lucide-react";

import { ChampionshipStatisticsPagination } from "./ChampionshipStatisticsFilters";

import type { ChampionshipPlayerStatistics } from "../types/championship.types";

type ChampionshipPlayerStatisticsTableProps = {
  errorMessage?: string;
  isLoading?: boolean;
  items: ChampionshipPlayerStatistics[];
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  total: number;
};

export function ChampionshipPlayerStatisticsTable({
  errorMessage = "",
  isLoading = false,
  items,
  onPageChange,
  page,
  pageSize,
  total,
}: ChampionshipPlayerStatisticsTableProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-card">
      <div className="p-5">
        <h3 className="text-lg font-black text-white">Estatisticas por atleta</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Jogos disputados, gols e cartoes por atleta.
        </p>
      </div>

      {errorMessage ? (
        <TableState icon={AlertTriangle} title="Falha ao carregar atletas" text={errorMessage} />
      ) : isLoading ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <TableState
          icon={UsersRound}
          title="Nenhum atleta encontrado"
          text="Nao ha estatisticas de atletas dentro dos filtros atuais."
        />
      ) : (
        <>
          <div className="overflow-x-auto border-t border-white/10">
            <table className="w-full min-w-[760px] border-collapse bg-black/20 text-left text-sm">
              <thead className="bg-white/[0.03] text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Atleta</th>
                  <th className="px-3 py-3">Equipe</th>
                  <th className="px-3 py-3 text-right">Jogos</th>
                  <th className="px-3 py-3 text-right">Gols</th>
                  <th className="px-3 py-3 text-right">CA</th>
                  <th className="px-3 py-3 text-right">CV</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={`${item.registrationId}:${item.playerId}`}
                    className="border-t border-white/10 text-slate-200"
                  >
                    <td className="px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-white">
                          {item.playerName || item.playerId}
                        </p>
                        {item.shirtNumber ? (
                          <p className="mt-0.5 text-xs font-semibold text-slate-500">
                            Camisa {item.shirtNumber}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-400">{item.teamName || "-"}</td>
                    <NumericCell value={item.matches} />
                    <NumericCell value={item.goals} strong />
                    <NumericCell value={item.yellowCards} />
                    <NumericCell value={item.redCards} />
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

function NumericCell({ strong = false, value }: { strong?: boolean; value: number }) {
  return (
    <td className={`px-3 py-3 text-right tabular-nums ${strong ? "font-black text-white" : ""}`}>
      {value}
    </td>
  );
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
  icon: typeof UsersRound;
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
