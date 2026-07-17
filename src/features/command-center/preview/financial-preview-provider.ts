import { getBiFinancial } from "@/features/bi/api/bi-financial.api";

import type { FinancialAdapterInput } from "../adapters/financial";
import { createFinancialProvider } from "../providers/financial";
import { normalizeFinancialPreviewSource } from "./financial-preview-normalizer";

async function loadFinancialContractInput(): Promise<FinancialAdapterInput> {
  const sourceContract = await getBiFinancial({ period: "CURRENT_MONTH" });
  return normalizeFinancialPreviewSource(sourceContract);
}

export const financialPreviewProvider = createFinancialProvider({
  load: loadFinancialContractInput,
});
