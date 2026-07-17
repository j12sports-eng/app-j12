import { getBiEvents } from "@/features/bi/api/bi-events.api";
import type { EventsAdapterInput } from "../adapters/events";
import { createEventsProvider } from "../providers/events";
import { normalizeEventsPreviewSource } from "./events-preview-normalizer";
async function loadEventsContractInput(): Promise<EventsAdapterInput> {
  return normalizeEventsPreviewSource(await getBiEvents({ period: "CURRENT_YEAR" }));
}
export const eventsPreviewProvider = createEventsProvider({ load: loadEventsContractInput });
