import type { BiProfessorsContract } from "../../contracts/teachers";
import type { BIProvider } from "../../providers/shared";
import { useBIContract, type BIHookOptions } from "../shared";

export function useProfessorsBI(
  provider: BIProvider<BiProfessorsContract>,
  options: BIHookOptions,
) {
  return useBIContract(provider, options);
}
