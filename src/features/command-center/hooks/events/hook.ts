import type { BiEventsContract } from "../../contracts/events";
import type { BIProvider } from "../../providers/shared";
import { useBIContract, type BIHookOptions } from "../shared";
export function useEventsBI(provider: BIProvider<BiEventsContract>, options: BIHookOptions) {
  return useBIContract(provider, options);
}
