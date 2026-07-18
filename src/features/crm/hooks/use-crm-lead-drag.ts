import { useCallback, useRef, useState } from "react";
import type { DragCancelEvent, DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import type { CrmLeadListItem, CrmLeadStage } from "../types/crm-lead.types";
import type { CrmPipeline } from "../types/crm-pipeline.types";
import { recordCrmLeadDragEvent } from "../observability/crm-lead-drag.observability";
export type CrmLeadDropRequest = {
  lead: CrmLeadListItem;
  toStage: CrmLeadStage;
  correlationId: string;
  startedAt: number;
};
export function useCrmLeadDrag({
  items,
  pipeline,
  onDrop,
}: {
  items: CrmLeadListItem[];
  pipeline: CrmPipeline;
  onDrop: (request: CrmLeadDropRequest) => void;
}) {
  const [activeLead, setActiveLead] = useState<CrmLeadListItem | null>(null);
  const [overStage, setOverStage] = useState<CrmLeadStage | null>(null);
  const session = useRef<{ correlationId: string; startedAt: number } | null>(null);
  const allowed = useCallback(
    (lead: CrmLeadListItem, stage: CrmLeadStage) =>
      pipeline.stages
        .find((candidate) => candidate.id === lead.stage)
        ?.transitions.includes(stage as never) === true,
    [pipeline],
  );
  function onDragStart(event: DragStartEvent) {
    const lead = items.find((item) => item.id === event.active.id);
    if (!lead) return;
    const startedAt = performance.now();
    const correlationId = crypto.randomUUID();
    session.current = { correlationId, startedAt };
    setActiveLead(lead);
    recordCrmLeadDragEvent("DRAG_STARTED", {
      correlationId,
      duration: 0,
      fromStage: lead.stage,
      leadId: lead.id,
    });
  }
  function onDragOver(event: DragOverEvent) {
    const stage = event.over?.data.current?.stage as CrmLeadStage | undefined;
    setOverStage(stage && activeLead && allowed(activeLead, stage) ? stage : null);
  }
  function onDragEnd(event: DragEndEvent) {
    const lead = activeLead;
    const currentSession = session.current;
    const stage = event.over?.data.current?.stage as CrmLeadStage | undefined;
    clear();
    if (!lead || !currentSession || !stage || !allowed(lead, stage)) {
      if (lead && currentSession) cancelTelemetry(lead, currentSession);
      return;
    }
    const request = { lead, toStage: stage, ...currentSession };
    recordCrmLeadDragEvent("DRAG_DROPPED", telemetry(request));
    onDrop(request);
  }
  function onDragCancel(_event: DragCancelEvent) {
    if (activeLead && session.current) cancelTelemetry(activeLead, session.current);
    clear();
  }
  function clear() {
    setActiveLead(null);
    setOverStage(null);
    session.current = null;
  }
  return { activeLead, allowed, onDragCancel, onDragEnd, onDragOver, onDragStart, overStage };
}
export function telemetry(request: CrmLeadDropRequest) {
  return {
    correlationId: request.correlationId,
    duration: performance.now() - request.startedAt,
    fromStage: request.lead.stage,
    leadId: request.lead.id,
    toStage: request.toStage,
  };
}
function cancelTelemetry(
  lead: CrmLeadListItem,
  session: { correlationId: string; startedAt: number },
) {
  recordCrmLeadDragEvent("DRAG_CANCELLED", {
    correlationId: session.correlationId,
    duration: performance.now() - session.startedAt,
    fromStage: lead.stage,
    leadId: lead.id,
  });
}
