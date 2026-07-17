import type {
  BiStudentPortalContract,
  StudentPortalContractData,
  StudentPortalKPIs,
} from "../../contracts/athlete-portal";
import { createBIContractEnvelope, type BIAdapterInput } from "../shared";

export type StudentPortalAdapterInput = BIAdapterInput<
  StudentPortalKPIs,
  StudentPortalContractData
>;

/** Reorganizes precomputed Student Portal data into the official contract. */
export function adaptStudentPortalContract(
  input: StudentPortalAdapterInput,
): BiStudentPortalContract {
  return createBIContractEnvelope(input);
}
