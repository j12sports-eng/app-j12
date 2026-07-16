import { useMemo, type ReactNode } from "react";

import { DASHBOARD_KPIS, DASHBOARD_SECTIONS } from "../config";
import { CommandCenterPage, type CommandCenterPageKpi } from "../pages";
import { CommandCenterService, type CommandCenterContracts } from "../services";
import { formatMoney, formatPercent } from "../utils";
import type { DashboardSectionId } from "@/features/command-center/config";
import type {
  CommandCenterMetric,
  CommandCenterTrend,
} from "@/features/command-center/types/command-center.types";

export type ExecutiveDashboardContainerProps = {
  actions?: ReactNode;
  contracts: CommandCenterContracts;
  description?: string;
  eyebrow?: string;
  filters?: ReactNode;
  title?: string;
  toolbar?: ReactNode;
  widgets?: Partial<Record<DashboardSectionId, ReactNode>>;
};

export function ExecutiveDashboardContainer({
  actions,
  contracts,
  description,
  eyebrow,
  filters,
  title,
  toolbar,
  widgets,
}: ExecutiveDashboardContainerProps) {
  const snapshot = useMemo(() => CommandCenterService.createSnapshot(contracts), [contracts]);
  const kpis = useMemo(
    () =>
      DASHBOARD_KPIS.map((definition) =>
        createPageKpi(
          definition,
          definition.metricKey ? snapshot.metricsById[definition.metricKey] : undefined,
        ),
      ),
    [snapshot.metricsById],
  );

  return (
    <CommandCenterPage
      actions={actions}
      description={description}
      eyebrow={eyebrow}
      filters={filters}
      generatedAt={snapshot.generatedAt}
      kpis={kpis}
      sections={DASHBOARD_SECTIONS}
      title={title}
      toolbar={toolbar}
      widgets={widgets}
    />
  );
}

function createPageKpi(
  definition: (typeof DASHBOARD_KPIS)[number],
  metric?: CommandCenterMetric,
): CommandCenterPageKpi {
  if (!metric?.available || metric.value === null) {
    return {
      description: metric?.reason || definition.description,
      icon: definition.icon,
      id: definition.id,
      label: metric?.label || kpiLabel(definition.id),
      tone: definition.tone,
      trend: "unavailable",
      trendLabel: "Indisponível",
      value: "—",
    };
  }

  return {
    description: definition.description,
    icon: definition.icon,
    id: definition.id,
    label: metric.label,
    tone: definition.tone,
    trend: metric.comparison?.trend ?? "unavailable",
    trendLabel: comparisonLabel(metric),
    value: formatMetric(metric),
  };
}

function formatMetric(metric: CommandCenterMetric) {
  if (metric.unit === "currency") return formatMoney(metric.value);
  if (metric.unit === "percentage") return formatPercent(metric.value);
  if (metric.unit === "hours") return `${metric.value?.toLocaleString("pt-BR")} h`;
  if (metric.unit === "days") return `${metric.value?.toLocaleString("pt-BR")} dias`;
  return metric.value?.toLocaleString("pt-BR") ?? "—";
}

function comparisonLabel(metric: CommandCenterMetric) {
  const comparison = metric.comparison;
  if (!comparison?.available || comparison.percent === null) return "Comparação indisponível";
  const prefix = comparison.percent >= 0 ? "+" : "";
  return `${prefix}${formatPercent(comparison.percent)} vs período anterior`;
}

function kpiLabel(id: (typeof DASHBOARD_KPIS)[number]["id"]) {
  return {
    activeStudents: "Alunos ativos",
    attendanceRate: "Taxa de frequência",
    championships: "Campeonatos",
    courtOccupancy: "Ocupação das quadras",
    delinquency: "Inadimplência",
    events: "Eventos",
    newEnrollments: "Novas matrículas",
    revenue: "Receita",
  }[id];
}

const _trendCompatibility: CommandCenterTrend = "unavailable";
void _trendCompatibility;
