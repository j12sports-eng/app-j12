import type { CrmLeadStage } from "./crm-lead.types";

export type CrmPipelineStageId = Exclude<CrmLeadStage, "TRIAL_SCHEDULED" | "TRIAL_COMPLETED">;

export type CrmPipelineStage = {
  id: CrmLeadStage;
  order: number;
  label: string;
  description: string;
  color: string;
  terminal: boolean;
  transitions: CrmPipelineStageId[];
};

export type CrmPipelineTransition = {
  from: CrmPipelineStageId;
  to: CrmPipelineStageId;
};

export type CrmPipelineCardField = {
  key: "leadId" | "source" | "assignedTo" | "status" | "updatedAt";
  label: string;
  configurable: true;
  visible: boolean;
};

export type CrmPipeline = {
  stages: CrmPipelineStage[];
  transitions: CrmPipelineTransition[];
  cardFields: CrmPipelineCardField[];
};
