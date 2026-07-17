import type { BiEventsContract, EventsContractData, EventsKPIs } from "../../contracts/events";
import { createBIContractEnvelope, type BIAdapterInput } from "../shared";
export type EventsAdapterInput = BIAdapterInput<EventsKPIs, EventsContractData>;
export function adaptEventsContract(input: EventsAdapterInput): BiEventsContract {
  return createBIContractEnvelope(input);
}
