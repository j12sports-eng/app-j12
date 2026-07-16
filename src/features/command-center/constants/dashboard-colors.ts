export const DASHBOARD_COLORS = {
  danger: "#ef4444",
  info: "#38bdf8",
  primary: "#ff4500",
  success: "#22c55e",
  violet: "#a855f7",
  warning: "#f59e0b",
} as const;

export const DASHBOARD_CHART_COLORS = [
  DASHBOARD_COLORS.primary,
  DASHBOARD_COLORS.success,
  DASHBOARD_COLORS.warning,
  DASHBOARD_COLORS.info,
  DASHBOARD_COLORS.violet,
  DASHBOARD_COLORS.danger,
] as const;
