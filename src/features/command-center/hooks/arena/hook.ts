import type { BiCourtsContract } from "../../contracts/arena";
import type { BIProvider } from "../../providers/shared";
import { useBIContract, type BIHookOptions } from "../shared";

export function useCourtsBI(provider: BIProvider<BiCourtsContract>, options: BIHookOptions) {
  return useBIContract(provider, options);
}
