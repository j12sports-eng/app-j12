import type { BIContractEnvelope } from "../shared";
import type { FinancialContractData, FinancialKPIs } from "./types";

/** Financial results and revenue/expense composition. */
export type BiFinancialContract = BIContractEnvelope<FinancialKPIs, FinancialContractData>;
