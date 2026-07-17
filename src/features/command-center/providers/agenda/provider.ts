import { adaptAgendaContract, type AgendaAdapterInput } from "../../adapters/agenda";
import type { BiAgendaPreviewContract } from "../../contracts/agenda";
import { createBIProvider, type BIProviderDependencies } from "../shared";

export type AgendaProviderDependencies = BIProviderDependencies<AgendaAdapterInput>;

export function createAgendaProvider(dependencies: AgendaProviderDependencies) {
  return createBIProvider<AgendaAdapterInput, BiAgendaPreviewContract>(
    dependencies,
    adaptAgendaContract,
  );
}
