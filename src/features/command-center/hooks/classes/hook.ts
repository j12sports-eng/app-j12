import type { BiClassesContract } from "../../contracts/classes";
import type { BIProvider } from "../../providers/shared";
import { useBIContract, type BIHookOptions } from "../shared";

export function useClassesBI(provider: BIProvider<BiClassesContract>, options: BIHookOptions) {
  return useBIContract(provider, options);
}
