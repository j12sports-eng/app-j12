import type { BiFinancialContract } from "../../contracts/financial";
import type { BIProvider } from "../../providers/shared";
import { useBIContract, type BIHookOptions } from "../shared";

export function useFinancialBI(provider: BIProvider<BiFinancialContract>, options: BIHookOptions) {
  return useBIContract(provider, options);
}
