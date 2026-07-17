import type { BIContractEnvelope } from "../shared";
import type { CommunicationContractData, CommunicationKPIs } from "./types";

/** Reach and effectiveness of operational communications. */
export type BiCommunicationContract = BIContractEnvelope<
  CommunicationKPIs,
  CommunicationContractData
>;
