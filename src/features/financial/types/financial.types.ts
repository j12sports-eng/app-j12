export type FinancialObligationStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED" | string;

export type EnrollmentFinancialObligation = {
  amount: number | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
  currency?: string | null;
  dueDate?: string | null;
  enrollmentId: string | null;
  id: string | null;
  metadata?: Record<string, unknown> | null;
  obligationType?: string | null;
  planId?: string | null;
  source?: string | null;
  status: FinancialObligationStatus | null;
  updatedAt?: string | null;
};

export type EnrollmentFinancialObligationsResponse = {
  count: number;
  enrollmentId: string;
  financialObligationsEndpointReady?: boolean;
  noGatewayIntegration?: boolean;
  noNotificationSideEffects?: boolean;
  obligations: EnrollmentFinancialObligation[];
};

export type StudentFinancialSummary = {
  amountCancelled: number;
  amountOpen: number;
  amountOverdue: number;
  amountPaid: number;
  amountTotal: number;
  byStatus: Record<string, number>;
  cancelled: number;
  open: number;
  overdue: number;
  paid: number;
  total: number;
};

export type StudentFinancialSummaryResponse = {
  count: number;
  financialSummaryEndpointReady?: boolean;
  noGatewayIntegration?: boolean;
  noNotificationSideEffects?: boolean;
  obligations: EnrollmentFinancialObligation[];
  studentPersonId: string;
  studentProfileId: string;
  summary: StudentFinancialSummary;
};

export type FinancialObligationActionResponse = {
  auditPersisted?: boolean;
  changed?: boolean;
  currentStatus?: FinancialObligationStatus | null;
  financialObligationStatusFlowEnabled?: boolean;
  gatewayIntegrated?: boolean;
  noGatewayIntegration?: boolean;
  noNotificationSideEffects?: boolean;
  noPaymentCreated?: boolean;
  obligation?: EnrollmentFinancialObligation | null;
  obligationId?: string | null;
  paymentCreated?: boolean;
  previousStatus?: FinancialObligationStatus | null;
  status?: FinancialObligationStatus | null;
  targetStatus?: FinancialObligationStatus | null;
  updated?: boolean;
};

export type MarkEnrollmentFinancialObligationPaidInput = {
  obligationId: string;
  paidAt: string;
  paidBy: string;
  paymentReference?: string | null;
};

export type CancelEnrollmentFinancialObligationInput = {
  cancelledAt: string;
  cancelledBy: string;
  obligationId: string;
  reason: string;
};

export type MarkEnrollmentFinancialObligationOverdueInput = {
  checkedAt: string;
  obligationId: string;
};
