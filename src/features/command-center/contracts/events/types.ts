import type { KPIDefinition } from "../shared";
export type EventsKPIId = "totalEvents" | "publishedEvents" | "completedEvents" | "upcomingEvents";
export type EventsKPIs = Record<EventsKPIId, KPIDefinition<"count">>;
export interface EventAggregateGroup {
  key: string;
  value: number;
}
export interface EventsContractData {
  monthlyEvolution: readonly EventAggregateGroup[];
  eventsByType: readonly EventAggregateGroup[];
  eventsByStatus: readonly EventAggregateGroup[];
}
