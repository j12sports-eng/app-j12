import { api } from "./api";

export type EnrollmentSummaryStatus = "NONE" | "DRAFT" | "ACTIVE" | "CONFLICT";

export type EnrollmentDomainStatus =
  | "ACTIVE"
  | "CANCELLED"
  | "DRAFT"
  | "FINISHED"
  | "PENDING"
  | "SUSPENDED"
  | string;

export type EnrollmentIdValue = number | string | null;

export type EnrollmentRecord = {
  confirmedAt?: string | null;
  confirmedBy?: string | null;
  createdAt?: string | null;
  deletedAt?: string | null;
  endDate?: string | null;
  id: EnrollmentIdValue;
  startDate?: string | null;
  status: EnrollmentDomainStatus | null;
  studentPersonId: EnrollmentIdValue;
  studentProfileId: EnrollmentIdValue;
  updatedAt?: string | null;
};

export type EnrollmentStudentScope = {
  studentPersonId: string;
  studentProfileId: string;
};

export type EnrollmentStatusSummary = {
  activeEnrollment: EnrollmentRecord | null;
  draftEnrollment: EnrollmentRecord | null;
  hasActiveEnrollment: boolean;
  hasDraftEnrollment: boolean;
  status: EnrollmentSummaryStatus;
  studentPersonId?: EnrollmentIdValue;
  studentProfileId?: EnrollmentIdValue;
};

export type EnrollmentStudentScopeSearchResult = {
  hasActiveEnrollment: boolean;
  hasDraftEnrollment: boolean;
  lastEnrollmentAt?: string | null;
  profileStatus?: string | null;
  status: EnrollmentSummaryStatus;
  studentCpf?: string | null;
  studentEmail?: string | null;
  studentName?: string | null;
  studentPersonId: EnrollmentIdValue;
  studentPhone?: string | null;
  studentProfileId: EnrollmentIdValue;
};

export type ConfirmDraftEnrollmentResponse = {
  alreadyConfirmed: boolean;
  confirmed: boolean;
  confirmedAt: string | null;
  confirmedBy: string | null;
  enrollment: EnrollmentRecord | null;
  status: "ACTIVE" | string;
};

function buildStudentScopeQuery(input: EnrollmentStudentScope) {
  const params = new URLSearchParams({
    studentPersonId: input.studentPersonId,
    studentProfileId: input.studentProfileId,
  });

  return params.toString();
}

// Uses only protected admin endpoints; the public /public/enrollments flow stays isolated.
export function getEnrollmentStatusSummary(input: EnrollmentStudentScope) {
  return api.get<EnrollmentStatusSummary>(
    `/admin/enrollments/status?${buildStudentScopeQuery(input)}`,
  );
}

export function searchEnrollmentStudentScopes(input: { query: string; limit?: number }) {
  const params = new URLSearchParams({
    q: input.query,
    limit: String(input.limit ?? 10),
  });

  return api.get<EnrollmentStudentScopeSearchResult[]>(
    `/admin/enrollments/students/search?${params.toString()}`,
  );
}

export function getCurrentDraftEnrollment(input: EnrollmentStudentScope) {
  return api.get<EnrollmentRecord | null>(
    `/admin/enrollments/current-draft?${buildStudentScopeQuery(input)}`,
  );
}

export function getCurrentActiveEnrollment(input: EnrollmentStudentScope) {
  return api.get<EnrollmentRecord | null>(
    `/admin/enrollments/current-active?${buildStudentScopeQuery(input)}`,
  );
}

export function confirmDraftEnrollment(enrollmentId: string, confirmedBy?: string | null) {
  return api.post<ConfirmDraftEnrollmentResponse>(
    `/admin/enrollments/${encodeURIComponent(enrollmentId)}/confirm`,
    { confirmedBy },
  );
}

export function canConfirmEnrollmentSummary(summary: EnrollmentStatusSummary | null) {
  return Boolean(
    summary?.status === "DRAFT" &&
    summary.draftEnrollment?.id &&
    !summary.hasActiveEnrollment &&
    !summary.activeEnrollment,
  );
}
