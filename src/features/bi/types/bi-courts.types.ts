import type { BiFoundationFilters, BiResolvedFilters } from "./bi-foundation.types";
export type CourtMetric = {
  available: boolean;
  reason: string | null;
  unit: "count" | "hours" | "currency" | "percentage";
  value: number | null;
};
export type CourtRank = {
  key?: string;
  courtId?: string;
  courtName?: string;
  unit?: string;
  availableHours?: number;
  reservedHours: number;
  occupancyRate?: number | null;
  reservations?: number;
  revenue: number | null;
};
export type BiCourtsContract = {
  contractVersion: "21.7";
  filters: { current: BiResolvedFilters };
  generatedAt: string;
  kpis: Record<
    | "availableHours"
    | "cancellations"
    | "occupancyRate"
    | "rentalRevenue"
    | "reservedHours"
    | "ticketAverage",
    CourtMetric
  >;
  rankings: { courts: CourtRank[]; days: CourtRank[]; hours: CourtRank[]; units: CourtRank[] };
  readOnly: true;
};
export type BiCourtsFilters = BiFoundationFilters;
