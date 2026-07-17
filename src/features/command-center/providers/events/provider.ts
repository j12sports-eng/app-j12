import { adaptEventsContract, type EventsAdapterInput } from "../../adapters/events";
import type { BiEventsContract } from "../../contracts/events";
import { createBIProvider, type BIProviderDependencies } from "../shared";
export function createEventsProvider(dependencies: BIProviderDependencies<EventsAdapterInput>) {
  return createBIProvider<EventsAdapterInput, BiEventsContract>(dependencies, adaptEventsContract);
}
