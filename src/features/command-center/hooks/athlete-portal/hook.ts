import type { BiStudentPortalContract } from "../../contracts/athlete-portal";
import type { BIProvider } from "../../providers/shared";
import { useBIContract, type BIHookOptions } from "../shared";

export function useStudentPortalBI(
  provider: BIProvider<BiStudentPortalContract>,
  options: BIHookOptions,
) {
  return useBIContract(provider, options);
}
