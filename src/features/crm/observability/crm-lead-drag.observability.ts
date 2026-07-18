import type { CrmLeadStage } from "../types/crm-lead.types";

export type CrmLeadDragEvent =
  | "DRAG_STARTED"
  | "DRAG_DROPPED"
  | "DRAG_CANCELLED"
  | "DRAG_SUCCEEDED"
  | "DRAG_FAILED";
type DragResult = "attempt" | "success" | "failure" | "cancelled";
export type CrmLeadDragTelemetry = {
  leadId: string;
  fromStage: CrmLeadStage;
  toStage?: CrmLeadStage;
  duration: number;
  correlationId: string;
};
export const CRM_DRAG_METRIC_NAMES = {
  attempts: "crm_drag_attempts_total",
  success: "crm_drag_success_total",
  failure: "crm_drag_failure_total",
  duration: "crm_drag_duration_ms",
} as const;
const counters = new Map<string, number>();
const durations: number[] = [];

/** Registra somente identificadores operacionais e estágios; nunca inclui PII. */
export function recordCrmLeadDragEvent(event: CrmLeadDragEvent, data: CrmLeadDragTelemetry) {
  const safe = Object.freeze({
    correlationId: data.correlationId.slice(0, 128),
    duration: Math.max(0, Math.trunc(data.duration)),
    fromStage: data.fromStage,
    leadId: data.leadId.slice(0, 64),
    ...(data.toStage ? { toStage: data.toStage } : {}),
  });
  const result = eventResult(event);
  if (event === "DRAG_DROPPED") increment(CRM_DRAG_METRIC_NAMES.attempts, safe, result);
  if (event === "DRAG_SUCCEEDED") increment(CRM_DRAG_METRIC_NAMES.success, safe, result);
  if (event === "DRAG_FAILED") increment(CRM_DRAG_METRIC_NAMES.failure, safe, result);
  if (event === "DRAG_SUCCEEDED" || event === "DRAG_FAILED") durations.push(safe.duration);
  globalThis.dispatchEvent?.(new CustomEvent("crm:drag", { detail: { event, ...safe } }));
}
export function getCrmLeadDragMetricsSnapshot() {
  return Object.freeze({
    counters: Object.freeze(Object.fromEntries(counters)),
    durations: [...durations],
  });
}
function increment(name: string, data: CrmLeadDragTelemetry, result: DragResult) {
  const key = `${name}|${JSON.stringify({ fromStage: data.fromStage, toStage: data.toStage, result })}`;
  counters.set(key, (counters.get(key) || 0) + 1);
}
function eventResult(event: CrmLeadDragEvent): DragResult {
  if (event === "DRAG_SUCCEEDED") return "success";
  if (event === "DRAG_FAILED") return "failure";
  if (event === "DRAG_CANCELLED") return "cancelled";
  return "attempt";
}
