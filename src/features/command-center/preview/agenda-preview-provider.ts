import { getBiAgenda } from "@/features/bi/api/bi-agenda.api";

import type { AgendaAdapterInput } from "../adapters/agenda";
import { createAgendaProvider } from "../providers/agenda";
import { normalizeAgendaPreviewSource } from "./agenda-preview-normalizer";

async function loadAgendaContractInput(): Promise<AgendaAdapterInput> {
  const sourceContract = await getBiAgenda({ period: "CURRENT_MONTH" });
  return normalizeAgendaPreviewSource(sourceContract);
}

export const agendaPreviewProvider = createAgendaProvider({
  load: loadAgendaContractInput,
});
