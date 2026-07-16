import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { KPITrendCard } from "../components/cards";
import {
  CommandCenterSection,
  DashboardFilters,
  DashboardGrid,
  DashboardHeader,
  DashboardToolbar,
} from "../components/layout";
import type { DashboardKpiId, DashboardSectionDefinition, DashboardSectionId } from "../config";
import type {
  CommandCenterTone,
  CommandCenterTrend,
} from "@/features/command-center/types/command-center.types";

export type CommandCenterPageKpi = {
  description?: string;
  icon: LucideIcon;
  id: DashboardKpiId;
  label: string;
  tone: CommandCenterTone;
  trend: CommandCenterTrend;
  trendLabel: string;
  value: string;
};

export type CommandCenterPageProps = {
  actions?: ReactNode;
  description?: string;
  eyebrow?: string;
  filters?: ReactNode;
  generatedAt?: string | null;
  kpis: CommandCenterPageKpi[];
  sections: DashboardSectionDefinition[];
  title?: string;
  toolbar?: ReactNode;
  widgets?: Partial<Record<DashboardSectionId, ReactNode>>;
};

export function CommandCenterPage({
  actions,
  description = "Indicadores executivos, operação e prioridades da J12 Sports em uma única visão.",
  eyebrow = "J12 Sports ERP 3.0",
  filters,
  generatedAt,
  kpis,
  sections,
  title = "Centro de Comando",
  toolbar,
  widgets = {},
}: CommandCenterPageProps) {
  const executiveSection = sections.find((section) => section.id === "executive");
  const contentSections = sections.filter((section) => section.id !== "executive");

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <DashboardHeader
        actions={actions}
        description={description}
        eyebrow={eyebrow}
        title={title}
      />

      {toolbar || generatedAt ? (
        <DashboardToolbar>
          <div>{toolbar}</div>
          {generatedAt ? (
            <p className="text-xs font-semibold text-slate-500">Atualizado em {generatedAt}</p>
          ) : null}
        </DashboardToolbar>
      ) : null}

      {filters ? <DashboardFilters>{filters}</DashboardFilters> : null}

      {executiveSection ? (
        <CommandCenterSection
          description={executiveSection.description}
          eyebrow={executiveSection.eyebrow}
          title={executiveSection.title}
        >
          <DashboardGrid>
            {kpis.map((kpi) => (
              <KPITrendCard
                key={kpi.id}
                description={kpi.description}
                icon={kpi.icon}
                label={kpi.label}
                tone={kpi.tone}
                trend={kpi.trend}
                trendLabel={kpi.trendLabel}
                value={kpi.value}
              />
            ))}
          </DashboardGrid>
          {widgets.executive ? <div className="mt-5">{widgets.executive}</div> : null}
        </CommandCenterSection>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        {contentSections.map((section) => (
          <CommandCenterSection
            key={section.id}
            className={section.id === "financial" || section.id === "alerts" ? "xl:col-span-2" : ""}
            description={section.description}
            eyebrow={section.eyebrow}
            title={section.title}
          >
            {widgets[section.id] ?? (
              <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
                Seção preparada para integração futura.
              </p>
            )}
          </CommandCenterSection>
        ))}
      </div>
    </div>
  );
}
