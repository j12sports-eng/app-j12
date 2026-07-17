import { getBiStudents } from "@/features/bi/api/bi-students.api";

import type { StudentsAdapterInput } from "../adapters/students";
import { createStudentsProvider } from "../providers/students";
import { normalizeStudentsPreviewSource } from "./students-preview-normalizer";

async function loadStudentsContractInput(): Promise<StudentsAdapterInput> {
  const sourceContract = await getBiStudents({ period: "CURRENT_MONTH" });
  return normalizeStudentsPreviewSource(sourceContract);
}

export const studentsPreviewProvider = createStudentsProvider({
  load: loadStudentsContractInput,
});
