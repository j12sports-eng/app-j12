import { useQuery } from "@tanstack/react-query";

import { getStudentFinancialSummary } from "../api/financial.api";

export const studentFinancialSummaryQueryKey = (
  studentPersonId: string | null,
  studentProfileId: string | null,
) => ["financial", "student-summary", studentPersonId || "", studentProfileId || ""];

export function useStudentFinancialSummary(input: {
  enabled?: boolean;
  limit?: number;
  studentPersonId: string | null;
  studentProfileId: string | null;
}) {
  const studentPersonId = String(input.studentPersonId || "").trim();
  const studentProfileId = String(input.studentProfileId || "").trim();

  return useQuery({
    enabled: Boolean(input.enabled && studentPersonId && studentProfileId),
    queryFn: () =>
      getStudentFinancialSummary({
        limit: input.limit ?? 100,
        studentPersonId,
        studentProfileId,
      }),
    queryKey: studentFinancialSummaryQueryKey(studentPersonId, studentProfileId),
    retry: 1,
  });
}
