import type {
  BiChampionshipsContract,
  ChampionshipsContractData,
  ChampionshipsKPIs,
} from "../../contracts/championships";
import { createBIContractEnvelope, type BIAdapterInput } from "../shared";

export type ChampionshipsAdapterInput = BIAdapterInput<
  ChampionshipsKPIs,
  ChampionshipsContractData
>;

/** Reorganizes precomputed championship data into the official contract. */
export function adaptChampionshipsContract(
  input: ChampionshipsAdapterInput,
): BiChampionshipsContract {
  return createBIContractEnvelope(input);
}
