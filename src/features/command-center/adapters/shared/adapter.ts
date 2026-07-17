import type {
  BIContractEnvelope,
  ContractMetadata,
  ContractSource,
  PreviousPeriod,
  ResolvedContractFilters,
} from "../../contracts/shared";

export interface BIAdapterInput<TKpis, TData> {
  capabilities: readonly string[];
  contractVersion: string;
  data: TData;
  filters: ResolvedContractFilters;
  generatedAt: string;
  kpis: TKpis;
  metadata: ContractMetadata;
  previousPeriod?: PreviousPeriod;
  source: ContractSource;
}

/** Preserves the source timestamp without parsing or generating a replacement. */
export function createContractGeneratedAt(generatedAt: string) {
  return generatedAt;
}

/** Reorganizes already-resolved filters into the contract envelope shape. */
export function createContractFilters(current: ResolvedContractFilters, previous?: PreviousPeriod) {
  return previous ? { current, previous } : { current };
}

/** Copies source-provided metadata without deriving values or applying defaults. */
export function createContractMetadata(metadata: ContractMetadata): ContractMetadata {
  return {
    cacheTtlSeconds: metadata.cacheTtlSeconds,
    correlationId: metadata.correlationId,
    partial: metadata.partial,
    warnings: metadata.warnings,
  };
}

/** Creates the common read-only envelope without calculating or normalizing domain data. */
export function createBIContractEnvelope<TKpis, TData>(
  input: BIAdapterInput<TKpis, TData>,
): BIContractEnvelope<TKpis, TData> {
  return {
    capabilities: input.capabilities,
    contractVersion: input.contractVersion,
    data: input.data,
    filters: createContractFilters(input.filters, input.previousPeriod),
    generatedAt: createContractGeneratedAt(input.generatedAt),
    kpis: input.kpis,
    metadata: createContractMetadata(input.metadata),
    readOnly: true,
    source: input.source,
  };
}
