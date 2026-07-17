import type { BIContractEnvelope } from "../shared";
import type { StudentPortalContractData, StudentPortalKPIs } from "./types";

/** Adoption and experience of the Student Portal. */
export type BiStudentPortalContract = BIContractEnvelope<
  StudentPortalKPIs,
  StudentPortalContractData
>;
