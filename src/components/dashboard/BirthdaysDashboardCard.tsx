import { memo } from "react";
import { Cake } from "lucide-react";

import { BirthdayTabs } from "@/components/dashboard/BirthdayTabs";
import { useDashboardBirthdays } from "@/hooks/BirthdayHook";

function BirthdaysDashboardCardComponent() {
  const { data, loading, error, reload } = useDashboardBirthdays();

  return (
    <section className="j12-surface overflow-hidden p-4 md:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            Relacionamento
          </p>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-black tracking-tight text-white md:text-xl">
            <Cake className="h-5 w-5 text-primary" aria-hidden="true" />
            Aniversariantes
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Alunos com aniversario hoje, nesta semana e neste mes para contato rapido da equipe.
          </p>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-black text-primary">
          {data.today.length} hoje
        </div>
      </div>

      <BirthdayTabs birthdays={data} loading={loading} error={error} onRetry={reload} />
    </section>
  );
}

export const BirthdaysDashboardCard = memo(BirthdaysDashboardCardComponent);
