import { useQuery } from "@tanstack/react-query";

import { getEnrollmentFinancialObligations } from "../api/financial.api";

export const enrollmentFinancialObligationsQueryKey = (enrollmentId: string | null) => [
  "financial",
  "enrollment-obligations",
  enrollmentId || "",
];

export function useEnrollmentFinancialObligations(input: {
  enabled?: boolean;
  enrollmentId: string | null;
  limit?: number;
}) {
  const enrollmentId = String(input.enrollmentId || "").trim();

  return useQuery({
    enabled: Boolean(input.enabled && enrollmentId),
    queryFn: () =>
      getEnrollmentFinancialObligations({
        enrollmentId,
        limit: input.limit ?? 50,
      }),
    queryKey: enrollmentFinancialObligationsQueryKey(enrollmentId),
    retry: 1,
  });
}
