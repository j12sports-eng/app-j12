import { api } from "@/lib/api";
import type { CrmLeadStage, CrmLeadStatus } from "../types/crm-lead.types";

export type CrmLeadStageTransitionInput = {
  nextStage: CrmLeadStage;
  reason?: string;
  expectedStage?: CrmLeadStage;
  expectedStatus?: CrmLeadStatus;
};

export type CrmLeadStageTransitionResult = {
  leadId: string;
  stage: CrmLeadStage;
  status: CrmLeadStatus;
  previousStage: CrmLeadStage;
  previousStatus: CrmLeadStatus;
  nextStage: CrmLeadStage;
  nextStatus: CrmLeadStatus;
  updatedAt: string;
};

export function moveCrmLeadStage(leadId: string, input: CrmLeadStageTransitionInput) {
  return api.patch<CrmLeadStageTransitionResult>(
    `/internal/crm/leads/${encodeURIComponent(leadId)}/stage`,
    input,
  );
}
