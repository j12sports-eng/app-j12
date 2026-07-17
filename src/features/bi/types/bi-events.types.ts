import type { BiFoundationFilters, BiResolvedFilters } from "./bi-foundation.types";
export type BiEventMetric = {
  available: boolean;
  reason: string | null;
  unit: "count";
  value: number | null;
};
export type BiEventDimension = { events: number; period?: string; status?: string; type?: string };
export type BiEventsContract = {
  version: "27.12";
  generatedAt: string;
  source: "j12_campeonatos";
  readOnly: true;
  filters: { current: BiResolvedFilters };
  kpis: Record<
    | "totalEvents"
    | "publishedEvents"
    | "completedEvents"
    | "upcomingEvents"
    | "scheduledEvents"
    | "cancelledEvents",
    BiEventMetric
  >;
  dimensions: {
    monthlyEvolution: BiEventDimension[];
    eventsByType: BiEventDimension[];
    eventsByStatus: BiEventDimension[];
    eventsByUnit: BiEventDimension[];
  };
};
export type BiEventsFilters = Pick<BiFoundationFilters, "period" | "startDate" | "endDate">;
