import { adaptFinancialContract, type FinancialAdapterInput } from "../../adapters/financial";
import type { BiFinancialContract } from "../../contracts/financial";
import { createBIProvider, type BIProviderDependencies } from "../shared";

export type FinancialProviderDependencies = BIProviderDependencies<FinancialAdapterInput>;

export function createFinancialProvider(dependencies: FinancialProviderDependencies) {
  return createBIProvider<FinancialAdapterInput, BiFinancialContract>(
    dependencies,
    adaptFinancialContract,
  );
}
