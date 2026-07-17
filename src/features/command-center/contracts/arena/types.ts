import type { KPIDefinition } from "../shared";

export type CourtsKPIId =
  | "availableHours"
  | "cancellations"
  | "occupancyRate"
  | "rentalRevenue"
  | "reservedHours"
  | "ticketAverage";

export type CourtsKPIs = Record<
  CourtsKPIId,
  KPIDefinition<"count" | "currency" | "hours" | "percentage">
>;

/** The 21.7 preview intentionally exposes no court, reservation or ranking rows. */
export type CourtsContractData = Readonly<Record<string, never>>;
