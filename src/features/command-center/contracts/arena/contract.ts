import type { BIContractEnvelope } from "../shared";
import type { CourtsContractData, CourtsKPIs } from "./types";

/** Usage, availability and rental results for arenas and courts. */
export type BiCourtsContract = BIContractEnvelope<CourtsKPIs, CourtsContractData>;
