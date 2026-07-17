import type { BiCourtsContract, CourtsContractData, CourtsKPIs } from "../../contracts/arena";
import { createBIContractEnvelope, type BIAdapterInput } from "../shared";

export type CourtsAdapterInput = BIAdapterInput<CourtsKPIs, CourtsContractData>;

/** Reorganizes precomputed arena and court data into the official contract. */
export function adaptCourtsContract(input: CourtsAdapterInput): BiCourtsContract {
  return createBIContractEnvelope(input);
}
