import type { LucideIcon } from "lucide-react";

import { DASHBOARD_ICONS } from "../constants";
import type { DashboardSectionId } from "./dashboard-sections";
import type {
  CommandCenterMetricUnit,
  CommandCenterTone,
} from "@/features/command-center/types/command-center.types";

export type DashboardKpiId =
  | "revenue"
  | "delinquency"
  | "activeStudents"
  | "newEnrollments"
  | "attendanceRate"
  | "courtOccupancy"
  | "events"
  | "championships";

export type DashboardKpiDefinition = {
  description: string;
  icon: LucideIcon;
  id: DashboardKpiId;
  metricKey: string | null;
  section: DashboardSectionId;
  tone: CommandCenterTone;
  unit: CommandCenterMetricUnit;
};

export const DASHBOARD_KPIS: DashboardKpiDefinition[] = [
  {
    description: "Receita recebida no período selecionado.",
    icon: DASHBOARD_ICONS.revenue,
    id: "revenue",
    metricKey: "bi.financial.receivedRevenue",
    section: "executive",
    tone: "success",
    unit: "currency",
  },
  {
    description: "Indicador reservado para o contrato dedicado de inadimplência.",
    icon: DASHBOARD_ICONS.delinquency,
    id: "delinquency",
    metricKey: null,
    section: "executive",
    tone: "danger",
    unit: "percentage",
  },
  {
    description: "Quantidade de alunos ativos no snapshot atual.",
    icon: DASHBOARD_ICONS.activeStudents,
    id: "activeStudents",
    metricKey: "bi.students.activeStudents",
    section: "executive",
    tone: "primary",
    unit: "count",
  },
  {
    description: "Matrículas confirmadas no período selecionado.",
    icon: DASHBOARD_ICONS.newStudents,
    id: "newEnrollments",
    metricKey: "bi.students.newEnrollments",
    section: "executive",
    tone: "primary",
    unit: "count",
  },
  {
    description: "Indicador reservado para um agregado canônico de presença.",
    icon: DASHBOARD_ICONS.attendance,
    id: "attendanceRate",
    metricKey: null,
    section: "executive",
    tone: "info",
    unit: "percentage",
  },
  {
    description: "Indicador reservado para o contrato BI de quadras.",
    icon: DASHBOARD_ICONS.occupancy,
    id: "courtOccupancy",
    metricKey: null,
    section: "executive",
    tone: "warning",
    unit: "percentage",
  },
  {
    description: "Indicador reservado para eventos consolidados.",
    icon: DASHBOARD_ICONS.performance,
    id: "events",
    metricKey: null,
    section: "executive",
    tone: "info",
    unit: "count",
  },
  {
    description: "Campeonatos ativos no snapshot atual.",
    icon: DASHBOARD_ICONS.activeChampionships,
    id: "championships",
    metricKey: "bi.championships.activeChampionships",
    section: "executive",
    tone: "primary",
    unit: "count",
  },
];
