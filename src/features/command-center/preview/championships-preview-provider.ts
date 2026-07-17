import { getBiChampionships } from "@/features/bi/api/bi-championships.api";

import type { ChampionshipsAdapterInput } from "../adapters/championships";
import { createChampionshipsProvider } from "../providers/championships";
import { normalizeChampionshipsPreviewSource } from "./championships-preview-normalizer";

async function loadChampionshipsContractInput(): Promise<ChampionshipsAdapterInput> {
  const sourceContract = await getBiChampionships({ period: "CURRENT_YEAR" });
  return normalizeChampionshipsPreviewSource(sourceContract);
}

export const championshipsPreviewProvider = createChampionshipsProvider({
  load: loadChampionshipsContractInput,
});
