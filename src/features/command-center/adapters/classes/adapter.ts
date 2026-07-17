import type { BiClassesContract, ClassesContractData, ClassesKPIs } from "../../contracts/classes";
import { createBIContractEnvelope, type BIAdapterInput } from "../shared";

export type ClassesAdapterInput = BIAdapterInput<ClassesKPIs, ClassesContractData>;

/** Reorganizes precomputed class data into the official contract. */
export function adaptClassesContract(input: ClassesAdapterInput): BiClassesContract {
  return createBIContractEnvelope(input);
}
