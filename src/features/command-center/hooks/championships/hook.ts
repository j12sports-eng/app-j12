import type { BiChampionshipsContract } from "../../contracts/championships";
import type { BIProvider } from "../../providers/shared";
import { useBIContract, type BIHookOptions } from "../shared";

export function useChampionshipsBI(
  provider: BIProvider<BiChampionshipsContract>,
  options: BIHookOptions,
) {
  return useBIContract(provider, options);
}
