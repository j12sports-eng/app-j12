import type { BiFoundationFilters, BiResolvedFilters } from "./bi-foundation.types";
export type BiInsightSeverity = "info" | "success" | "warning" | "critical";
export type BiAdministrativeInsight = {
  action: string;
  currentMetric: number | null;
  dataSource: string;
  description: string;
  id: string;
  period: BiResolvedFilters | null;
  previousReference: number | null;
  severity: BiInsightSeverity;
  timestamp: string;
  title: string;
  type: string;
  variation: number | null;
};
export type BiInsightsContract = {
  contractVersion: "21.11";
  generatedAt: string;
  insights: BiAdministrativeInsight[];
  readOnly: true;
  thresholds: Record<string, number>;
};
export type BiInsightsFilters = BiFoundationFilters;
