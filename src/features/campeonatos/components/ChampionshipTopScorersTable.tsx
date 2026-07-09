import { AlertTriangle, Trophy } from "lucide-react";

import { ChampionshipStatisticsPagination } from "./ChampionshipStatisticsFilters";

import type { ChampionshipTopScorerRankingItem } from "../types/championship.types";

type ChampionshipTopScorersTableProps = {
  errorMessage?: string;
  isLoading?: boolean;
  items: ChampionshipTopScorerRankingItem[];
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  total: number;
};

export function ChampionshipTopScorersTable({
  errorMessage = "",
  isLoading = false,
  items,
  onPageChange,
  page,
  pageSize,
  total,
}: ChampionshipTopScorersTableProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-card">
      <div className="p-5">
        <h3 className="text-lg font-black text-white">Artilharia</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Gols, jogos e cartoes dos atletas com gols registrados.
        </p>
      </div>

      {errorMessage ? (
        <TableState icon={AlertTriangle} title="Falha ao carregar artilharia" text={errorMessage} />
      ) : isLoading ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <TableState
          icon={Trophy}
          title="Artilharia vazia"
          text="Nenhum gol registrado dentro dos filtros atuais."
        />
      ) : (
        <>
          <div className="overflow-x-auto border-t border-white/10">
            <table className="w-full min-w-[760px] border-collapse bg-black/20 text-left text-sm">
              <thead className="bg-white/[0.03] text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Atleta</th>
                  <th className="px-3 py-3">Equipe</th>
                  <th className="px-3 py-3 text-right">Gols</th>
                  <th className="px-3 py-3 text-right">Jogos</th>
                  <th className="px-3 py-3 text-right">CA</th>
                  <th className="px-3 py-3 text-right">CV</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={`${item.playerId}:${item.position}`}
                    className="border-t border-white/10 text-slate-200"
                  >
                    <td className="px-3 py-3">
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-2 text-xs font-black text-primary">
                        {item.position}
                      </span>
                    </td>
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
                    <NumericCell value={item.goals} strong />
                    <NumericCell value={item.matches} />
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
  icon: typeof Trophy;
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
