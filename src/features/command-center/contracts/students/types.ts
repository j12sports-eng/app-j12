import type { KPIDefinition } from "../shared";

export type StudentsKPIId =
  | "activeEnrollments"
  | "activeStudents"
  | "averageTenureDays"
  | "cancellations"
  | "churnRate"
  | "netGrowth"
  | "newEnrollments"
  | "newStudents"
  | "retentionRate";

export type StudentsKPIs = Record<StudentsKPIId, KPIDefinition>;

export interface StudentDimensionItem {
  key: string;
  value: number;
}

export interface StudentsContractData {
  distributions: Readonly<Record<string, readonly StudentDimensionItem[]>>;
  evolution: readonly { newEnrollments: number; newStudents: number; period: string }[];
}
