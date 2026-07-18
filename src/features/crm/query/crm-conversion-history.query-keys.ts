export const crmConversionHistory = (filters: Record<string, unknown>) =>
  ["crm", "conversion-history", "list", filters] as const;

export const crmConversionHistoryDetail = (conversionId: string) =>
  ["crm", "conversion-history", "detail", conversionId] as const;

export const crmConversionHistoryQueryKeys = {
  all: ["crm", "conversion-history"] as const,
  detail: crmConversionHistoryDetail,
  list: crmConversionHistory,
};
