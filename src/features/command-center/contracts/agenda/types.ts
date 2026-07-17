import type { KPIDefinition } from "../shared";

export type AgendaKPIId =
  | "activeRecurrenceSeries"
  | "cancelledOccurrences"
  | "cancelledRecurrenceSeries"
  | "cancellationRate"
  | "modifiedOccurrences"
  | "recurrenceSeries";

export type AgendaKPIs = Record<AgendaKPIId, KPIDefinition<"count" | "percentage">>;

export interface AgendaTimelinePoint {
  cancelledOccurrences: number;
  date: string;
  modifiedOccurrences: number;
}

export interface AgendaContractData {
  exceptionTypes: readonly {
    key: "CANCELLED" | "MODIFIED";
    value: number;
  }[];
  timeline: readonly AgendaTimelinePoint[];
}
