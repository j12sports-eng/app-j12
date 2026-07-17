import type { BIContractEnvelope } from "../shared";
import type { ChampionshipsContractData, ChampionshipsKPIs } from "./types";

/** Operation and results of championships, registrations and matches. */
export type BiChampionshipsContract = BIContractEnvelope<
  ChampionshipsKPIs,
  ChampionshipsContractData
>;
