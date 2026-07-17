import type { BIContractEnvelope } from "../shared";
import type { ProfessorsContractData, ProfessorsKPIs } from "./types";

/** Availability, allocation and compliance of the coaching staff. */
export type BiProfessorsContract = BIContractEnvelope<ProfessorsKPIs, ProfessorsContractData>;
