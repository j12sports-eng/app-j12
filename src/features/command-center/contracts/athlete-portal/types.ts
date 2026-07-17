import type { KPIDefinition } from "../shared";

export type StudentPortalKPIId =
  | "activeUsers"
  | "accessFrequency"
  | "pendingActions"
  | "portalPayments";

export type StudentPortalKPIs = Record<StudentPortalKPIId, KPIDefinition>;

export interface StudentPortalActivity {
  action: string;
  occurredAt: string;
  userId: string;
}

export interface StudentPortalContractData {
  recentActivity: readonly StudentPortalActivity[];
}
