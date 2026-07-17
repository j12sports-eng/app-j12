import {
  adaptGuardianPortalContract,
  type GuardianPortalAdapterInput,
} from "../../adapters/guardian-portal";
import type { BiGuardianPortalContract } from "../../contracts/guardian-portal";
import { createBIProvider, type BIProviderDependencies } from "../shared";

export type GuardianPortalProviderDependencies = BIProviderDependencies<GuardianPortalAdapterInput>;

export function createGuardianPortalProvider(dependencies: GuardianPortalProviderDependencies) {
  return createBIProvider<GuardianPortalAdapterInput, BiGuardianPortalContract>(
    dependencies,
    adaptGuardianPortalContract,
  );
}
