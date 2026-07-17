import type { BIContractEnvelope } from "../shared";
import type { AgendaContractData, AgendaKPIs } from "./types";

export type BiAgendaPreviewContract = BIContractEnvelope<AgendaKPIs, AgendaContractData>;
