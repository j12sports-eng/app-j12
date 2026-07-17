import type { BIContractEnvelope } from "../shared";
import type { GuardianPortalContractData, GuardianPortalKPIs } from "./types";

/** Adoption and experience of the Guardian Portal. */
export type BiGuardianPortalContract = BIContractEnvelope<
  GuardianPortalKPIs,
  GuardianPortalContractData
>;
