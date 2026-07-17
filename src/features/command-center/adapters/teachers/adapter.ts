import type {
  BiProfessorsContract,
  ProfessorsContractData,
  ProfessorsKPIs,
} from "../../contracts/teachers";
import { createBIContractEnvelope, type BIAdapterInput } from "../shared";

export type ProfessorsAdapterInput = BIAdapterInput<ProfessorsKPIs, ProfessorsContractData>;

/** Reorganizes precomputed professor data into the official contract. */
export function adaptProfessorsContract(input: ProfessorsAdapterInput): BiProfessorsContract {
  return createBIContractEnvelope(input);
}
