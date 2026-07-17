import { adaptCourtsContract, type CourtsAdapterInput } from "../../adapters/arena";
import type { BiCourtsContract } from "../../contracts/arena";
import { createBIProvider, type BIProviderDependencies } from "../shared";

export type CourtsProviderDependencies = BIProviderDependencies<CourtsAdapterInput>;

export function createCourtsProvider(dependencies: CourtsProviderDependencies) {
  return createBIProvider<CourtsAdapterInput, BiCourtsContract>(dependencies, adaptCourtsContract);
}
