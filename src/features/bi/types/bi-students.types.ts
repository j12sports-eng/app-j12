import type { BiComparison, BiFoundationFilters, BiResolvedFilters } from "./bi-foundation.types";
export type BiStudentsMetric = {
  available: boolean;
  comparison: BiComparison;
  reason: string | null;
  unit: "count" | "percentage" | "days";
  value: number | null;
};
export type BiStudentsDimension = { key: string; value: number };
export type BiStudentsContract = {
  contractVersion: "21.4";
  distributions: {
    ageGroups: BiStudentsDimension[];
    modalities: BiStudentsDimension[];
    units: BiStudentsDimension[];
  };
  evolution: Array<{ newEnrollments: number; newStudents: number; period: string }>;
  filters: {
    current: BiResolvedFilters;
    previous: Pick<BiResolvedFilters, "startDate" | "endDate" | "timezone" | "unitId">;
  };
  generatedAt: string;
  kpis: Record<
    | "activeEnrollments"
    | "activeStudents"
    | "averageTenureDays"
    | "cancellations"
    | "churnRate"
    | "netGrowth"
    | "newEnrollments"
    | "newStudents"
    | "retentionRate"
    | "transfers",
    BiStudentsMetric
  >;
  readOnly: true;
};
export type BiStudentsFilters = BiFoundationFilters;
