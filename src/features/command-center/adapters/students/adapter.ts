import type {
  BiStudentsContract,
  StudentsContractData,
  StudentsKPIs,
} from "../../contracts/students";
import { createBIContractEnvelope, type BIAdapterInput } from "../shared";

export type StudentsAdapterInput = BIAdapterInput<StudentsKPIs, StudentsContractData>;

/** Reorganizes precomputed student data into the official contract. */
export function adaptStudentsContract(input: StudentsAdapterInput): BiStudentsContract {
  return createBIContractEnvelope(input);
}
