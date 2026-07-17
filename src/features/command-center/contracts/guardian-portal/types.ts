import type { KPIDefinition } from "../shared";

export type GuardianPortalKPIId =
  | "accesses"
  | "activeGuardians"
  | "messagesRead"
  | "pendingActions"
  | "portalPayments";

export type GuardianPortalKPIs = Record<GuardianPortalKPIId, KPIDefinition>;

export interface GuardianPortalActivity {
  action: string;
  guardianId: string;
  occurredAt: string;
  studentId: string | null;
}

export interface GuardianPortalContractData {
  recentActivity: readonly GuardianPortalActivity[];
}
