import type { KPIDefinition } from "../shared";

export type CommunicationKPIId =
  | "activeCampaigns"
  | "deliveryRate"
  | "failedMessages"
  | "readRate"
  | "reach"
  | "sentMessages";

export type CommunicationKPIs = Record<CommunicationKPIId, KPIDefinition>;

export interface CommunicationChannelSnapshot {
  channel: "email" | "push" | "whatsapp" | "other";
  delivered: number;
  failed: number;
  read: number;
  sent: number;
}

export interface CommunicationContractData {
  channels: readonly CommunicationChannelSnapshot[];
}
