import type { LucideIcon } from "lucide-react";

import type { BiFoundationFilters } from "@/features/bi/types/bi-foundation.types";

export type CommandCenterTone = "primary" | "success" | "warning" | "danger" | "info";

export type CommandCenterWidgetStatus =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "unavailable"
  | "error";

export type CommandCenterMetricUnit =
  | "count"
  | "currency"
  | "percentage"
  | "hours"
  | "days"
  | "average";

export type CommandCenterTrend = "positive" | "negative" | "neutral" | "unavailable";

export type CommandCenterComparison = {
  available: boolean;
  percent: number | null;
  previousValue: number | null;
  reason: string | null;
  trend: CommandCenterTrend;
};

export type CommandCenterMetric = {
  available: boolean;
  comparison?: CommandCenterComparison;
  contractVersion?: string;
  generatedAt?: string;
  id: string;
  label: string;
  reason: string | null;
  source?: string;
  unit: CommandCenterMetricUnit;
  value: number | null;
};

export type CommandCenterWidgetState = {
  errorMessage?: string | null;
  generatedAt?: string;
  isFetching?: boolean;
  isStale?: boolean;
  retry?: () => void;
  status: CommandCenterWidgetStatus;
};

export type CommandCenterFilters = BiFoundationFilters;

export type CommandCenterKpiPresentation = {
  description?: string;
  icon: LucideIcon;
  metric: CommandCenterMetric;
  state?: CommandCenterWidgetState;
  tone?: CommandCenterTone;
};
