import { adaptStudentsContract, type StudentsAdapterInput } from "../../adapters/students";
import type { BiStudentsContract } from "../../contracts/students";
import { createBIProvider, type BIProviderDependencies } from "../shared";

export type StudentsProviderDependencies = BIProviderDependencies<StudentsAdapterInput>;

export function createStudentsProvider(dependencies: StudentsProviderDependencies) {
  return createBIProvider<StudentsAdapterInput, BiStudentsContract>(
    dependencies,
    adaptStudentsContract,
  );
}
