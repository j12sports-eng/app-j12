import { getBiClasses } from "@/features/bi/api/bi-classes.api";

import type { ClassesAdapterInput } from "../adapters/classes";
import { createClassesProvider } from "../providers/classes";
import { normalizeClassesPreviewSource } from "./classes-preview-normalizer";

async function loadClassesContractInput(): Promise<ClassesAdapterInput> {
  const sourceContract = await getBiClasses({ period: "CURRENT_MONTH" });
  return normalizeClassesPreviewSource(sourceContract);
}

export const classesPreviewProvider = createClassesProvider({
  load: loadClassesContractInput,
});
