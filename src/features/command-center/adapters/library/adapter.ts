import type { BiLibraryContract, LibraryContractData, LibraryKPIs } from "../../contracts/library";
import { createBIContractEnvelope, type BIAdapterInput } from "../shared";

export type LibraryAdapterInput = BIAdapterInput<LibraryKPIs, LibraryContractData>;

/** Reorganizes precomputed library data into the official contract. */
export function adaptLibraryContract(input: LibraryAdapterInput): BiLibraryContract {
  return createBIContractEnvelope(input);
}
