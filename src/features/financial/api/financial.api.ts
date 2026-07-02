import { api } from "@/lib/api";

import type {
  CancelEnrollmentFinancialObligationInput,
  EnrollmentFinancialObligationsResponse,
  FinancialObligationActionResponse,
  MarkEnrollmentFinancialObligationOverdueInput,
  MarkEnrollmentFinancialObligationPaidInput,
  StudentFinancialSummaryResponse,
} from "../types/financial.types";

function withLimit(endpoint: string, limit?: number) {
  const normalizedLimit = Number(limit);

  if (!Number.isFinite(normalizedLimit) || normalizedLimit <= 0) {
    return endpoint;
  }

  return `${endpoint}?limit=${encodeURIComponent(String(Math.trunc(normalizedLimit)))}`;
}

export function getEnrollmentFinancialObligations(input: { enrollmentId: string; limit?: number }) {
  const enrollmentId = encodeURIComponent(input.enrollmentId.trim());

  return api.get<EnrollmentFinancialObligationsResponse>(
    withLimit(`/admin/financial/enrollments/${enrollmentId}/obligations`, input.limit),
  );
}

export function getStudentFinancialSummary(input: {
  limit?: number;
  studentPersonId: string;
  studentProfileId: string;
}) {
  const studentPersonId = encodeURIComponent(input.studentPersonId.trim());
  const studentProfileId = encodeURIComponent(input.studentProfileId.trim());

  return api.get<StudentFinancialSummaryResponse>(
    withLimit(
      `/admin/financial/students/${studentPersonId}/${studentProfileId}/summary`,
      input.limit,
    ),
  );
}

export function markEnrollmentFinancialObligationPaid(
  input: MarkEnrollmentFinancialObligationPaidInput,
) {
  return api.post<FinancialObligationActionResponse>(
    `/admin/financial/obligations/${encodeURIComponent(input.obligationId)}/mark-paid`,
    {
      paidAt: input.paidAt,
      paidBy: input.paidBy,
      paymentReference: input.paymentReference || null,
    },
  );
}

export function cancelEnrollmentFinancialObligation(
  input: CancelEnrollmentFinancialObligationInput,
) {
  return api.post<FinancialObligationActionResponse>(
    `/admin/financial/obligations/${encodeURIComponent(input.obligationId)}/cancel`,
    {
      cancelledAt: input.cancelledAt,
      cancelledBy: input.cancelledBy,
      reason: input.reason,
    },
  );
}

export function markEnrollmentFinancialObligationOverdue(
  input: MarkEnrollmentFinancialObligationOverdueInput,
) {
  return api.post<FinancialObligationActionResponse>(
    `/admin/financial/obligations/${encodeURIComponent(input.obligationId)}/mark-overdue`,
    {
      checkedAt: input.checkedAt,
    },
  );
}
