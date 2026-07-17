import type { KPIDefinition } from "../shared";

export type ClassesKPIId =
  | "activeClasses"
  | "availableSpots"
  | "attendanceRate"
  | "fullClasses"
  | "occupancyRate"
  | "underutilizedClasses";

export type ClassesKPIs = Record<ClassesKPIId, KPIDefinition<"count" | "percentage">>;

export interface ClassSnapshot {
  active: boolean;
  capacity: number | null;
  classId: string;
  className: string;
  occupancy: number;
  occupancyRate: number | null;
  professorName: string | null;
  unitId: string | null;
}

export interface ClassesContractData {
  classes: readonly ClassSnapshot[];
}
