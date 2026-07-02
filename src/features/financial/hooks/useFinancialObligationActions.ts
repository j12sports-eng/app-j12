import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  cancelEnrollmentFinancialObligation,
  markEnrollmentFinancialObligationOverdue,
  markEnrollmentFinancialObligationPaid,
} from "../api/financial.api";
import { enrollmentFinancialObligationsQueryKey } from "./useEnrollmentFinancialObligations";
import { studentFinancialSummaryQueryKey } from "./useStudentFinancialSummary";

import type {
  CancelEnrollmentFinancialObligationInput,
  MarkEnrollmentFinancialObligationOverdueInput,
  MarkEnrollmentFinancialObligationPaidInput,
} from "../types/financial.types";

export function useFinancialObligationActions(input: {
  enrollmentId?: string | null;
  studentPersonId?: string | null;
  studentProfileId?: string | null;
}) {
  const queryClient = useQueryClient();

  function invalidateFinancialAdminQueries() {
    void queryClient.invalidateQueries({
      queryKey: enrollmentFinancialObligationsQueryKey(input.enrollmentId || null),
    });
    void queryClient.invalidateQueries({
      queryKey: studentFinancialSummaryQueryKey(
        input.studentPersonId || null,
        input.studentProfileId || null,
      ),
    });
  }

  const markPaid = useMutation({
    mutationFn: (payload: MarkEnrollmentFinancialObligationPaidInput) =>
      markEnrollmentFinancialObligationPaid(payload),
    onSuccess: invalidateFinancialAdminQueries,
  });

  const cancel = useMutation({
    mutationFn: (payload: CancelEnrollmentFinancialObligationInput) =>
      cancelEnrollmentFinancialObligation(payload),
    onSuccess: invalidateFinancialAdminQueries,
  });

  const markOverdue = useMutation({
    mutationFn: (payload: MarkEnrollmentFinancialObligationOverdueInput) =>
      markEnrollmentFinancialObligationOverdue(payload),
    onSuccess: invalidateFinancialAdminQueries,
  });

  return {
    cancel,
    markOverdue,
    markPaid,
    working: markPaid.isPending || cancel.isPending || markOverdue.isPending,
  };
}
