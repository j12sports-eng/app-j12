import type { BiFoundationFilters, BiResolvedFilters } from "./bi-foundation.types";

export type BiAgendaMetric = {
  available: boolean;
  reason: string | null;
  unit: "count" | "minutes" | "percentage";
  value: number | null;
};

export type BiAgendaTimelinePoint = {
  cancelledOccurrences: number;
  date: string;
  modifiedOccurrences: number;
};

export type BiAgendaContract = {
  contractVersion: "21.12";
  distributions: {
    exceptionTypes: {
      available: boolean;
      items: Array<{ key: "CANCELLED" | "MODIFIED"; value: number }> | null;
      reason: string | null;
    };
  };
  filters: { current: BiResolvedFilters };
  generatedAt: string;
  kpis: Record<
    | "activeRecurrenceSeries"
    | "cancelledOccurrences"
    | "cancelledRecurrenceSeries"
    | "cancellationRate"
    | "completedAppointments"
    | "conflicts"
    | "futureAppointments"
    | "modifiedOccurrences"
    | "recurrenceSeries"
    | "replacementAppointments"
    | "scheduledDurationMinutes"
    | "totalAppointments",
    BiAgendaMetric
  >;
  metadata: {
    aggregation: "DATABASE";
    operationalRowsIncluded: false;
    queryCount: number;
    unitAuthorizationScope: "SYSTEM_MANAGEMENT";
  };
  readOnly: true;
  source: {
    tables: string[];
    type: "MYSQL_AGGREGATE_READ_ONLY";
  };
  timeline: BiAgendaTimelinePoint[];
  warnings: string[];
};

export type BiAgendaFilters = BiFoundationFilters;
