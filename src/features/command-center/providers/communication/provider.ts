import {
  adaptCommunicationContract,
  type CommunicationAdapterInput,
} from "../../adapters/communication";
import type { BiCommunicationContract } from "../../contracts/communication";
import { createBIProvider, type BIProviderDependencies } from "../shared";

export type CommunicationProviderDependencies = BIProviderDependencies<CommunicationAdapterInput>;

export function createCommunicationProvider(dependencies: CommunicationProviderDependencies) {
  return createBIProvider<CommunicationAdapterInput, BiCommunicationContract>(
    dependencies,
    adaptCommunicationContract,
  );
}
