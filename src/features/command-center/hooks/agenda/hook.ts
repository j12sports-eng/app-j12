import type { BiAgendaPreviewContract } from "../../contracts/agenda";
import type { BIProvider } from "../../providers/shared";
import { useBIContract, type BIHookOptions } from "../shared";

export function useAgendaBI(provider: BIProvider<BiAgendaPreviewContract>, options: BIHookOptions) {
  return useBIContract(provider, options);
}
