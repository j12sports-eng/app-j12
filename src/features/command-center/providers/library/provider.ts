import { adaptLibraryContract, type LibraryAdapterInput } from "../../adapters/library";
import type { BiLibraryContract } from "../../contracts/library";
import { createBIProvider, type BIProviderDependencies } from "../shared";

export type LibraryProviderDependencies = BIProviderDependencies<LibraryAdapterInput>;

export function createLibraryProvider(dependencies: LibraryProviderDependencies) {
  return createBIProvider<LibraryAdapterInput, BiLibraryContract>(
    dependencies,
    adaptLibraryContract,
  );
}
