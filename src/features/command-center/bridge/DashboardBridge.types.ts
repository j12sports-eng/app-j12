import type { ReactNode } from "react";

import type { DashboardSectionId } from "../config";
import type { CommandCenterContracts } from "../services";

export interface DashboardFilters {
  search?: string;
  categoryIds?: readonly string[];
  programIds?: readonly string[];
  status?: readonly string[];
  custom?: Readonly<Record<string, unknown>>;
}

export interface DashboardPeriod {
  endDate: string;
  preset?: string;
  startDate: string;
}

export interface DashboardUserContext {
  id: string;
  name: string;
  roles?: readonly string[];
}

export interface DashboardUnitContext {
  id: string;
  name: string;
  timezone?: string;
}

export interface DashboardCallbacks {
  onFiltersChange?: (filters: DashboardFilters) => void;
  onPeriodChange?: (period: DashboardPeriod) => void;
  onRefresh?: () => void;
  onRetry?: () => void;
  onUnitChange?: (unitId: string) => void;
}

export interface DashboardRuntimeState {
  error?: unknown;
  isFetching?: boolean;
  isStale?: boolean;
  status: "idle" | "loading" | "success" | "empty" | "error";
}

export interface DashboardBridgeProps {
  actions?: ReactNode;
  callbacks?: DashboardCallbacks;
  contracts: CommandCenterContracts;
  dashboardFilters?: DashboardFilters;
  description?: string;
  eyebrow?: string;
  filterControls?: ReactNode;
  period?: DashboardPeriod;
  runtimeState?: DashboardRuntimeState;
  title?: string;
  toolbar?: ReactNode;
  unit?: DashboardUnitContext;
  user?: DashboardUserContext;
  widgets?: Partial<Record<DashboardSectionId, ReactNode>>;
}
