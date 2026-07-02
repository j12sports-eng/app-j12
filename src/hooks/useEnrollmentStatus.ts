import { useCallback, useState } from "react";

import { formatApiErrorMessage } from "@/lib/api";
import {
  canConfirmEnrollmentSummary,
  confirmDraftEnrollment,
  getEnrollmentStatusSummary,
  type ConfirmDraftEnrollmentResponse,
  type EnrollmentStatusSummary,
  type EnrollmentStudentScope,
} from "@/lib/enrollments-api";

type EnrollmentStatusState = {
  actionLoading: boolean;
  error: string | null;
  loading: boolean;
  message: string | null;
  scope: EnrollmentStudentScope;
  summary: EnrollmentStatusSummary | null;
};

function normalizeScope(input?: Partial<EnrollmentStudentScope>): EnrollmentStudentScope {
  return {
    studentPersonId: String(input?.studentPersonId ?? "").trim(),
    studentProfileId: String(input?.studentProfileId ?? "").trim(),
  };
}

function hasCompleteScope(scope: EnrollmentStudentScope) {
  return Boolean(scope.studentPersonId && scope.studentProfileId);
}

function withScopeFallback(
  summary: EnrollmentStatusSummary,
  scope: EnrollmentStudentScope,
): EnrollmentStatusSummary {
  return {
    ...summary,
    studentPersonId: summary.studentPersonId ?? scope.studentPersonId,
    studentProfileId: summary.studentProfileId ?? scope.studentProfileId,
  };
}

export function useEnrollmentStatus(initialScope?: Partial<EnrollmentStudentScope>) {
  const [state, setState] = useState<EnrollmentStatusState>(() => ({
    actionLoading: false,
    error: null,
    loading: false,
    message: null,
    scope: normalizeScope(initialScope),
    summary: null,
  }));

  const setScope = useCallback((nextScope: Partial<EnrollmentStudentScope>) => {
    setState((current) => ({
      ...current,
      scope: normalizeScope(nextScope),
    }));
  }, []);

  const loadStatus = useCallback(
    async (nextScope: Partial<EnrollmentStudentScope> = state.scope) => {
      const scope = normalizeScope(nextScope);

      if (!hasCompleteScope(scope)) {
        setState((current) => ({
          ...current,
          error: "Informe studentPersonId e studentProfileId para consultar.",
          loading: false,
          message: null,
          scope,
          summary: null,
        }));
        return null;
      }

      try {
        setState((current) => ({
          ...current,
          error: null,
          loading: true,
          message: null,
          scope,
        }));

        const summary = await getEnrollmentStatusSummary(scope);
        const nextSummary = withScopeFallback(summary, scope);

        setState((current) => ({
          ...current,
          error: null,
          loading: false,
          scope,
          summary: nextSummary,
        }));

        return nextSummary;
      } catch (error) {
        setState((current) => ({
          ...current,
          error: formatApiErrorMessage(error, "Nao foi possivel carregar matriculas."),
          loading: false,
          scope,
          summary: null,
        }));
        return null;
      }
    },
    [state.scope],
  );

  const confirmDraft = useCallback(
    async (confirmedBy?: string | null): Promise<ConfirmDraftEnrollmentResponse | null> => {
      if (!canConfirmEnrollmentSummary(state.summary)) {
        setState((current) => ({
          ...current,
          error: "Confirmacao bloqueada para o estado atual da matricula.",
          message: null,
        }));
        return null;
      }

      const enrollmentId = String(state.summary?.draftEnrollment?.id ?? "").trim();

      try {
        setState((current) => ({
          ...current,
          actionLoading: true,
          error: null,
          message: null,
        }));

        const response = await confirmDraftEnrollment(enrollmentId, confirmedBy);
        const message = response.alreadyConfirmed
          ? "Matricula ja estava ativa."
          : "Matricula confirmada com sucesso.";

        setState((current) => ({
          ...current,
          actionLoading: false,
          message,
        }));

        await loadStatus(state.scope);

        return response;
      } catch (error) {
        setState((current) => ({
          ...current,
          actionLoading: false,
          error: formatApiErrorMessage(error, "Nao foi possivel confirmar a matricula."),
          message: null,
        }));
        return null;
      }
    },
    [loadStatus, state.scope, state.summary],
  );

  return {
    actionLoading: state.actionLoading,
    activeEnrollment: state.summary?.activeEnrollment ?? null,
    canConfirm: canConfirmEnrollmentSummary(state.summary),
    confirmDraft,
    draftEnrollment: state.summary?.draftEnrollment ?? null,
    error: state.error,
    hasActiveEnrollment: Boolean(state.summary?.hasActiveEnrollment),
    hasDraftEnrollment: Boolean(state.summary?.hasDraftEnrollment),
    loadStatus,
    loading: state.loading,
    message: state.message,
    scope: state.scope,
    setScope,
    status: state.summary?.status ?? "NONE",
    summary: state.summary,
  };
}
