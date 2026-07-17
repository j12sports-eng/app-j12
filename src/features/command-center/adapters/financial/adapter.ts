import type {
  BiFinancialContract,
  FinancialContractData,
  FinancialKPIs,
} from "../../contracts/financial";
import { createBIContractEnvelope, type BIAdapterInput } from "../shared";

export type FinancialAdapterInput = BIAdapterInput<FinancialKPIs, FinancialContractData>;

/** Reorganizes precomputed financial data into the official contract. */
export function adaptFinancialContract(input: FinancialAdapterInput): BiFinancialContract {
  return createBIContractEnvelope(input);
}
