import { useQuery } from "@tanstack/react-query";

import { searchFinancialStudentScopes } from "../api/financial.api";

export const financialStudentScopeSearchQueryKey = (query: string | null) => [
  "financial",
  "student-scope-search",
  query || "",
];

export function useFinancialStudentScopeSearch(input: {
  enabled?: boolean;
  limit?: number;
  query: string | null;
}) {
  const query = String(input.query || "").trim();

  return useQuery({
    enabled: Boolean(input.enabled && query.length >= 2),
    queryFn: () =>
      searchFinancialStudentScopes({
        limit: input.limit ?? 8,
        query,
      }),
    queryKey: financialStudentScopeSearchQueryKey(query),
    retry: 1,
  });
}
