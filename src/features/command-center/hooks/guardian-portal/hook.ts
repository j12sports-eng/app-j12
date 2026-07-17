import type { BiGuardianPortalContract } from "../../contracts/guardian-portal";
import type { BIProvider } from "../../providers/shared";
import { useBIContract, type BIHookOptions } from "../shared";

export function useGuardianPortalBI(
  provider: BIProvider<BiGuardianPortalContract>,
  options: BIHookOptions,
) {
  return useBIContract(provider, options);
}
