import {
  adaptStudentPortalContract,
  type StudentPortalAdapterInput,
} from "../../adapters/athlete-portal";
import type { BiStudentPortalContract } from "../../contracts/athlete-portal";
import { createBIProvider, type BIProviderDependencies } from "../shared";

export type StudentPortalProviderDependencies = BIProviderDependencies<StudentPortalAdapterInput>;

export function createStudentPortalProvider(dependencies: StudentPortalProviderDependencies) {
  return createBIProvider<StudentPortalAdapterInput, BiStudentPortalContract>(
    dependencies,
    adaptStudentPortalContract,
  );
}
