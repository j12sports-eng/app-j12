import type {
  AgendaContractData,
  AgendaKPIs,
  BiAgendaPreviewContract,
} from "../../contracts/agenda";
import { createBIContractEnvelope, type BIAdapterInput } from "../shared";

export type AgendaAdapterInput = BIAdapterInput<AgendaKPIs, AgendaContractData>;

export function adaptAgendaContract(input: AgendaAdapterInput): BiAgendaPreviewContract {
  return createBIContractEnvelope(input);
}
