import { adaptProfessorsContract, type ProfessorsAdapterInput } from "../../adapters/teachers";
import type { BiProfessorsContract } from "../../contracts/teachers";
import { createBIProvider, type BIProviderDependencies } from "../shared";

export type ProfessorsProviderDependencies = BIProviderDependencies<ProfessorsAdapterInput>;

export function createProfessorsProvider(dependencies: ProfessorsProviderDependencies) {
  return createBIProvider<ProfessorsAdapterInput, BiProfessorsContract>(
    dependencies,
    adaptProfessorsContract,
  );
}
