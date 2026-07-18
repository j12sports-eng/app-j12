export type CrmConversionResolution = "CREATED" | "FOUND" | null;

export type CrmConversionHistoryItem = {
  id: string;
  leadId: string | null;
  unitId: string | null;
  personId: string | null;
  personProfileId: string | null;
  enrollmentId: string | null;
  enrollmentStatus: "DRAFT" | null;
  conversionStatus: "COMPLETED" | null;
  convertedBy: string | null;
  convertedAt: string | null;
  correlationId: string | null;
  resolutions: {
    person: CrmConversionResolution;
    profile: CrmConversionResolution;
    enrollment: CrmConversionResolution;
  };
  reused: {
    person: boolean | null;
    profile: boolean | null;
    enrollment: boolean | null;
  };
};

export type CrmConversionHistoryDetail = CrmConversionHistoryItem & {
  source: "crm_lead_enrollment_conversions";
  version: string | null;
};

export type CrmConversionHistoryPage = {
  items: CrmConversionHistoryItem[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
};

export type CrmConversionHistoryFilters = {
  leadId?: string;
  unitId?: string;
  convertedBy?: string;
  enrollmentStatus?: "DRAFT";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};
