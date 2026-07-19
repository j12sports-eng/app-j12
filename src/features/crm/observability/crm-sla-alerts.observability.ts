import type { CrmLeadStage } from "../types/crm-lead.types";
import type { CrmSlaAlertStatus } from "../types/crm-sla-alerts.types";

export type CrmSlaAlertsEvent =
  | "CRM_SLA_ALERTS_VIEWED"
  | "CRM_SLA_ALERTS_FILTERED"
  | "CRM_SLA_ALERT_OPENED"
  | "CRM_SLA_ALERTS_LOAD_FAILED";

export type CrmSlaAlertsTelemetry = {
  alertStatus?: CrmSlaAlertStatus;
  durationMs?: number;
  filterCount?: number;
  result?: "success" | "empty" | "failure" | "applied" | "cleared";
  stage?: CrmLeadStage;
};

/** Emite somente dimensões operacionais de baixa cardinalidade, sem IDs ou filtros completos. */
export function recordCrmSlaAlertsEvent(
  event: CrmSlaAlertsEvent,
  data: CrmSlaAlertsTelemetry = {},
) {
  const safe = Object.freeze({
    ...(data.alertStatus ? { alertStatus: data.alertStatus } : {}),
    ...(Number.isFinite(data.durationMs)
      ? { durationMs: Math.max(0, Math.trunc(data.durationMs as number)) }
      : {}),
    ...(Number.isFinite(data.filterCount)
      ? { filterCount: Math.max(0, Math.trunc(data.filterCount as number)) }
      : {}),
    ...(data.result ? { result: data.result } : {}),
    source: "crm_sla_alerts_panel",
    ...(data.stage ? { stage: data.stage } : {}),
  });

  if (typeof CustomEvent !== "undefined") {
    globalThis.dispatchEvent?.(new CustomEvent("crm:sla-alerts", { detail: { event, ...safe } }));
  }
}
