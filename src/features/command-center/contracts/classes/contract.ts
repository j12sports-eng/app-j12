import type { BIContractEnvelope } from "../shared";
import type { ClassesContractData, ClassesKPIs } from "./types";

/** Capacity, occupancy and attendance of classes. */
export type BiClassesContract = BIContractEnvelope<ClassesKPIs, ClassesContractData>;
