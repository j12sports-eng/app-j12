import type { BiLibraryContract } from "../../contracts/library";
import type { BIProvider } from "../../providers/shared";
import { useBIContract, type BIHookOptions } from "../shared";

export function useLibraryBI(provider: BIProvider<BiLibraryContract>, options: BIHookOptions) {
  return useBIContract(provider, options);
}
