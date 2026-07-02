import { memo, useMemo } from "react";

import { BirthdayCarousel } from "@/components/dashboard/BirthdayCarousel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { BirthdayTab, DashboardBirthdaysResponse } from "@/types/BirthdayTypes";

const BIRTHDAY_TABS: Array<{
  value: BirthdayTab;
  label: string;
  ariaLabel: string;
}> = [
  {
    value: "today",
    label: "🎉 Hoje",
    ariaLabel: "Aniversariantes de hoje",
  },
  {
    value: "week",
    label: "🎈 Esta Semana",
    ariaLabel: "Aniversariantes desta semana",
  },
  {
    value: "month",
    label: "🎂 Este Mês",
    ariaLabel: "Aniversariantes deste mes",
  },
];

type BirthdayTabsProps = {
  birthdays: DashboardBirthdaysResponse;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

function BirthdayTabsComponent({
  birthdays,
  loading = false,
  error = null,
  onRetry,
}: BirthdayTabsProps) {
  const totals = useMemo(
    () => ({
      today: birthdays.today.length,
      week: birthdays.week.length,
      month: birthdays.month.length,
    }),
    [birthdays.month.length, birthdays.today.length, birthdays.week.length],
  );

  return (
    <Tabs defaultValue="today" className="mt-5">
      <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-black/30 p-1.5 sm:grid-cols-3">
        {BIRTHDAY_TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={cn(
              "min-h-11 rounded-xl px-3 py-2 text-sm font-black text-slate-400 transition data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:shadow-[0_0_24px_rgba(255,69,0,0.2)]",
            )}
            aria-label={`${tab.ariaLabel}: ${totals[tab.value]} encontrados`}
          >
            <span className="truncate">{tab.label}</span>
            <span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-black data-[state=active]:text-black">
              {totals[tab.value]}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      {BIRTHDAY_TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-5">
          <BirthdayCarousel
            students={birthdays[tab.value]}
            loading={loading}
            error={error}
            onRetry={onRetry}
            ariaLabel={tab.ariaLabel}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

export const BirthdayTabs = memo(BirthdayTabsComponent);
