import type { BiFoundationFilters, BiResolvedFilters } from "./bi-foundation.types";
export type BiClassesMetric = {
  available: boolean;
  reason: string | null;
  unit: "count" | "percentage";
  value: number | null;
};
export type BiClassesDimensionItem = {
  capacity: number;
  classes: number;
  key: string;
  occupancy: number;
  occupancyRate: number | null;
};
export type BiClassesDimension = {
  available: boolean;
  items: BiClassesDimensionItem[] | null;
  reason: string | null;
};
export type BiClassRow = {
  active: boolean;
  availableSpots: number | null;
  capacity: number | null;
  capacityValid: boolean;
  classId: string;
  className: string;
  daysOfWeek: string[];
  endTime: string | null;
  full: boolean;
  modality: string;
  occupancy: number;
  occupancyRate: number | null;
  professorName: string | null;
  startTime: string | null;
  status: string | null;
  underutilized: boolean;
  unit: string;
};
export type BiClassesContract = {
  contractVersion: "21.5";
  dimensions: Record<
    "categories" | "daysOfWeek" | "modalities" | "schedules" | "units",
    BiClassesDimension
  >;
  filters: { current: BiResolvedFilters };
  generatedAt: string;
  kpis: Record<
    | "activeClasses"
    | "availableSpots"
    | "enrolledStudents"
    | "fullClasses"
    | "occupancyRate"
    | "totalCapacity"
    | "underutilizedClasses",
    BiClassesMetric
  >;
  readOnly: true;
  table: BiClassRow[];
};
export type BiClassesFilters = BiFoundationFilters;
