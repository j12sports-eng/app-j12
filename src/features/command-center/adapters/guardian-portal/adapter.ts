import type {
  BiGuardianPortalContract,
  GuardianPortalContractData,
  GuardianPortalKPIs,
} from "../../contracts/guardian-portal";
import { createBIContractEnvelope, type BIAdapterInput } from "../shared";

export type GuardianPortalAdapterInput = BIAdapterInput<
  GuardianPortalKPIs,
  GuardianPortalContractData
>;

/** Reorganizes precomputed Guardian Portal data into the official contract. */
export function adaptGuardianPortalContract(
  input: GuardianPortalAdapterInput,
): BiGuardianPortalContract {
  return createBIContractEnvelope(input);
}
