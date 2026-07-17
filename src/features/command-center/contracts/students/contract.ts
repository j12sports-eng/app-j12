import type { BIContractEnvelope } from "../shared";
import type { StudentsContractData, StudentsKPIs } from "./types";

/** Evolution, retention and profile of the student base. */
export type BiStudentsContract = BIContractEnvelope<StudentsKPIs, StudentsContractData>;
