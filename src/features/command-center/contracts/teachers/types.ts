import type { KPIDefinition } from "../shared";

export type ProfessorsKPIId =
  | "activeProfessors"
  | "allocatedHours"
  | "allocatedProfessors"
  | "classesWithoutProfessor"
  | "pendingContracts"
  | "scheduleConflicts";

export type ProfessorsKPIs = Record<ProfessorsKPIId, KPIDefinition>;

export interface ProfessorAllocation {
  allocatedHours: number;
  classIds: readonly string[];
  professorId: string;
  professorName: string;
  unitIds: readonly string[];
}

export interface ProfessorsContractData {
  allocations: readonly ProfessorAllocation[];
}
