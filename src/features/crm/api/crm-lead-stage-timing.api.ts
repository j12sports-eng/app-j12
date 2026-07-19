import { api } from "@/lib/api";
import type { CrmLeadStageTimingDetail } from "../types/crm-lead-stage-timing.types";

export async function getCrmLeadStageTiming(leadId: string): Promise<CrmLeadStageTimingDetail> {
  return api.get<CrmLeadStageTimingDetail>(
    `/internal/crm/leads/${encodeURIComponent(leadId)}/stage-timing`,
  );
}
