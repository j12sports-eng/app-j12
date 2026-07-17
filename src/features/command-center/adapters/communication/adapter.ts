import type {
  BiCommunicationContract,
  CommunicationContractData,
  CommunicationKPIs,
} from "../../contracts/communication";
import { createBIContractEnvelope, type BIAdapterInput } from "../shared";

export type CommunicationAdapterInput = BIAdapterInput<
  CommunicationKPIs,
  CommunicationContractData
>;

/** Reorganizes precomputed communication data into the official contract. */
export function adaptCommunicationContract(
  input: CommunicationAdapterInput,
): BiCommunicationContract {
  return createBIContractEnvelope(input);
}
