import type { KPIDefinition } from "../shared";

export type LibraryKPIId =
  | "activeContents"
  | "downloads"
  | "engagementRate"
  | "outdatedContents"
  | "views";

export type LibraryKPIs = Record<LibraryKPIId, KPIDefinition>;

export interface LibraryContentSnapshot {
  category: string;
  contentId: string;
  downloads: number;
  status: string;
  title: string;
  views: number;
}

export interface LibraryContractData {
  contents: readonly LibraryContentSnapshot[];
}
