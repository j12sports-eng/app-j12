import { api } from "@/lib/api";
import type { CrmPipeline } from "../types/crm-pipeline.types";

export async function getCrmPipeline(): Promise<CrmPipeline> {
  return api.get<CrmPipeline>("/internal/crm/pipeline");
}
