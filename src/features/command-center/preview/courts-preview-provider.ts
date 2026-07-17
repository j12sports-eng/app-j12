import { getBiCourts } from "@/features/bi/api/bi-courts.api";

import type { CourtsAdapterInput } from "../adapters/arena";
import { createCourtsProvider } from "../providers/arena";
import { normalizeCourtsPreviewSource } from "./courts-preview-normalizer";

async function loadCourtsContractInput(): Promise<CourtsAdapterInput> {
  const sourceContract = await getBiCourts({ period: "CURRENT_MONTH" });
  return normalizeCourtsPreviewSource(sourceContract);
}

export const courtsPreviewProvider = createCourtsProvider({ load: loadCourtsContractInput });
