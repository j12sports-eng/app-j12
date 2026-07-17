import type { BiStudentsContract } from "../../contracts/students";
import type { BIProvider } from "../../providers/shared";
import { useBIContract, type BIHookOptions } from "../shared";

export function useStudentsBI(provider: BIProvider<BiStudentsContract>, options: BIHookOptions) {
  return useBIContract(provider, options);
}
