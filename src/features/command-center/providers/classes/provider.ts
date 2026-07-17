import { adaptClassesContract, type ClassesAdapterInput } from "../../adapters/classes";
import type { BiClassesContract } from "../../contracts/classes";
import { createBIProvider, type BIProviderDependencies } from "../shared";

export type ClassesProviderDependencies = BIProviderDependencies<ClassesAdapterInput>;

export function createClassesProvider(dependencies: ClassesProviderDependencies) {
  return createBIProvider<ClassesAdapterInput, BiClassesContract>(
    dependencies,
    adaptClassesContract,
  );
}
