import type { DashboardSectionId } from "./dashboard-sections";

export type DashboardWidgetId =
  | "financialCard"
  | "studentCard"
  | "attendanceCard"
  | "birthdayWidget"
  | "alertWidget"
  | "notificationsWidget"
  | "recentActivityWidget"
  | "quickActionsWidget"
  | "lineChartWidget"
  | "barChartWidget"
  | "pieChartWidget"
  | "areaChartWidget"
  | "gaugeWidget";

export type DashboardWidgetDefinition = {
  component: string;
  id: DashboardWidgetId;
  section: DashboardSectionId;
  width: "full" | "half" | "third" | "two-thirds";
};

export const DASHBOARD_WIDGETS: DashboardWidgetDefinition[] = [
  {
    component: "FinancialCard",
    id: "financialCard",
    section: "financial",
    width: "third",
  },
  {
    component: "StudentCard",
    id: "studentCard",
    section: "students",
    width: "half",
  },
  {
    component: "AttendanceCard",
    id: "attendanceCard",
    section: "classes",
    width: "half",
  },
  {
    component: "BirthdayWidget",
    id: "birthdayWidget",
    section: "agenda",
    width: "half",
  },
  {
    component: "AlertWidget",
    id: "alertWidget",
    section: "alerts",
    width: "full",
  },
  {
    component: "NotificationsWidget",
    id: "notificationsWidget",
    section: "alerts",
    width: "full",
  },
  {
    component: "RecentActivityWidget",
    id: "recentActivityWidget",
    section: "agenda",
    width: "half",
  },
  {
    component: "QuickActionsWidget",
    id: "quickActionsWidget",
    section: "executive",
    width: "full",
  },
  {
    component: "LineChartWidget",
    id: "lineChartWidget",
    section: "students",
    width: "half",
  },
  {
    component: "BarChartWidget",
    id: "barChartWidget",
    section: "championships",
    width: "half",
  },
  {
    component: "PieChartWidget",
    id: "pieChartWidget",
    section: "financial",
    width: "third",
  },
  {
    component: "AreaChartWidget",
    id: "areaChartWidget",
    section: "financial",
    width: "two-thirds",
  },
  {
    component: "GaugeWidget",
    id: "gaugeWidget",
    section: "rentals",
    width: "half",
  },
];
