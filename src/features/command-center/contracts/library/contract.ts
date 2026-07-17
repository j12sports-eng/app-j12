import type { BIContractEnvelope } from "../shared";
import type { LibraryContractData, LibraryKPIs } from "./types";

/** Usage, availability and engagement of the content library. */
export type BiLibraryContract = BIContractEnvelope<LibraryKPIs, LibraryContractData>;
