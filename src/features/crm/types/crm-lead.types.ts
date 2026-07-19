import type { CrmLeadStageTimingSummary } from "./crm-lead-stage-timing.types";

export type CrmLeadStage =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST"
  | "TRIAL_SCHEDULED"
  | "TRIAL_COMPLETED";

export type CrmLeadStatus = "OPEN" | "CONVERTED" | "LOST" | "ARCHIVED";

export type CrmLeadConversionFilter = "NONE" | "STUDENT_COMPLETED" | "ENROLLMENT_COMPLETED";

export type CrmLeadEligibility = {
  canConvertToDraftEnrollment: boolean;
  reasonCode: string | null;
};

export type CrmLeadConversionSummary = {
  studentCompleted: boolean;
  enrollmentCompleted: boolean;
  enrollmentStatus: "DRAFT" | string | null;
};

export type CrmLeadListItem = {
  id: string;
  unitId: string;
  source: string | null;
  assignedTo: string | null;
  stage: CrmLeadStage;
  status: CrmLeadStatus;
  createdAt: string;
  updatedAt: string;
  eligibility: CrmLeadEligibility;
  conversions: CrmLeadConversionSummary;
  stageTiming: CrmLeadStageTimingSummary;
};

export type CrmLeadConversionDetail = {
  status: string | null;
  personId: string | null;
  personProfileId: string | null;
  convertedAt: string | null;
};

export type CrmLeadEnrollmentConversionDetail = {
  status: string | null;
  enrollmentId: string | null;
  enrollmentStatus: string | null;
  convertedAt: string | null;
};

export type CrmLeadDetail = CrmLeadListItem & {
  contact: {
    nome: string | null;
    email: string | null;
    telefone: string | null;
  };
  conversions: CrmLeadConversionSummary & {
    student: CrmLeadConversionDetail;
    enrollment: CrmLeadEnrollmentConversionDetail;
  };
};

export type CrmLeadPage = {
  items: CrmLeadListItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
};

export type CrmLeadFilters = {
  stage?: CrmLeadStage;
  status?: CrmLeadStatus;
  conversionStatus?: CrmLeadConversionFilter;
  unitId?: string;
  limit?: number;
};

export type CrmStudentData = {
  nome: string;
  dataNascimento: string;
  sexo: "M" | "F" | "OUTRO";
  cpf?: string;
  email?: string;
  telefone?: string;
};

export type CrmLeadDraftEnrollmentPayload = {
  studentData: CrmStudentData;
  enrollmentData: { startDate: string };
  idempotencyKey?: string;
};

export type CrmLeadConversionResult = {
  conversionStatus: "COMPLETED";
  enrollmentId: string;
  enrollmentStatus: "DRAFT";
  leadId: string;
  personId: string;
  personProfileId: string;
  resolutions: {
    enrollment: "CREATED" | "FOUND";
    person: "CREATED" | "FOUND";
    profile: "CREATED" | "FOUND";
  };
  reused: {
    enrollment: boolean;
    person: boolean;
    profile: boolean;
  };
};
