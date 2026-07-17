import type {
  ContractMetadata,
  ContractSource,
  PreviousPeriod,
  ResolvedContractFilters,
} from "./types";

/** Common, read-only envelope implemented by every Command Center BI contract. */
export interface BIContractEnvelope<TKpis, TData = unknown> {
  capabilities: readonly string[];
  contractVersion: string;
  data?: TData;
  filters: {
    current: ResolvedContractFilters;
    previous?: PreviousPeriod;
  };
  generatedAt: string;
  kpis: TKpis;
  metadata: ContractMetadata;
  readOnly: true;
  source: ContractSource;
}
