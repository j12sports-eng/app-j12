import {
  adaptChampionshipsContract,
  type ChampionshipsAdapterInput,
} from "../../adapters/championships";
import type { BiChampionshipsContract } from "../../contracts/championships";
import { createBIProvider, type BIProviderDependencies } from "../shared";

export type ChampionshipsProviderDependencies = BIProviderDependencies<ChampionshipsAdapterInput>;

export function createChampionshipsProvider(dependencies: ChampionshipsProviderDependencies) {
  return createBIProvider<ChampionshipsAdapterInput, BiChampionshipsContract>(
    dependencies,
    adaptChampionshipsContract,
  );
}
