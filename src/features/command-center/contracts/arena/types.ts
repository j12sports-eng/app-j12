import type { KPIDefinition } from "../shared";

export type CourtsKPIId =
  | "availableHours"
  | "cancellations"
  | "conflicts"
  | "occupancyRate"
  | "rentalRevenue"
  | "reservedHours";

export type CourtsKPIs = Record<CourtsKPIId, KPIDefinition>;

export interface CourtAvailabilitySlot {
  courtId: string;
  endAt: string;
  occupied: boolean;
  startAt: string;
  unitId: string;
}

export interface CourtsContractData {
  availability: readonly CourtAvailabilitySlot[];
}
