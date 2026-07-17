import type { BiCommunicationContract } from "../../contracts/communication";
import type { BIProvider } from "../../providers/shared";
import { useBIContract, type BIHookOptions } from "../shared";

export function useCommunicationBI(
  provider: BIProvider<BiCommunicationContract>,
  options: BIHookOptions,
) {
  return useBIContract(provider, options);
}
