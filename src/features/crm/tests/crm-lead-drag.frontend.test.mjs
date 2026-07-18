import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("secure drag uses pipeline transitions and the canonical PATCH mutation", () => {
  const hook = read("hooks/use-crm-lead-drag.ts");
  const page = read("pages/CrmLeadsPage.tsx");
  assert.match(hook, /transitions\.includes/);
  assert.match(hook, /DRAG_CANCELLED/);
  assert.match(page, /useMoveCrmLeadStage/);
  assert.match(page, /expectedStage: request\.lead\.stage/);
  assert.match(page, /expectedStatus: request\.lead\.status/);
  assert.doesNotMatch(page, /setQueryData/);
});

test("invalid targets, placeholder, overlay, loading and visual rollback are represented", () => {
  const column = read("components/PipelineColumn.tsx");
  const card = read("components/PipelineCard.tsx");
  const overlay = read("components/PipelineDragOverlay.tsx");
  const page = read("pages/CrmLeadsPage.tsx");
  assert.match(column, /dragState === "allowed"/);
  assert.match(column, /cursor-not-allowed/);
  assert.match(column, /border-dashed/);
  assert.match(card, /submitting/);
  assert.match(card, /useDraggable/);
  assert.match(overlay, /Movendo lead/);
  assert.match(page, /DragOverlay/);
  assert.match(page, /voltou à coluna original/);
});

test("LOST and WON require confirmation while manual and keyboard paths remain available", () => {
  const page = read("pages/CrmLeadsPage.tsx");
  const dialog = read("components/CrmLeadStageTransitionDialog.tsx");
  assert.match(page, /request\.toStage === "LOST" \|\| request\.toStage === "WON"/);
  assert.match(dialog, /target === "LOST"/);
  assert.match(dialog, /initialStage/);
  assert.match(page, /KeyboardSensor/);
  assert.match(page, /onChangeStage=\{onChangeStage\}/);
});

test("success and conflict invalidate every CRM projection", () => {
  const mutation = read("hooks/use-crm-leads.ts");
  for (const key of [
    "crmLeadQueryKeys.all",
    "crmLeadQueryKeys.detail",
    "crmPipelineQueryKeys.all",
    "crmConversionHistoryQueryKeys.all",
  ]) {
    assert.match(mutation, new RegExp(key.replaceAll(".", "\\.")));
  }
  assert.match(mutation, /CRM_STAGE_CONFLICT/);
});

test("drag observability contains the required safe events and metrics", () => {
  const source = read("observability/crm-lead-drag.observability.ts");
  for (const value of [
    "DRAG_STARTED",
    "DRAG_DROPPED",
    "DRAG_CANCELLED",
    "DRAG_SUCCEEDED",
    "DRAG_FAILED",
    "crm_drag_attempts_total",
    "crm_drag_success_total",
    "crm_drag_failure_total",
    "crm_drag_duration_ms",
  ])
    assert.match(source, new RegExp(value));
  assert.doesNotMatch(source, /unitId|userId|actorId|contactName|email|phone/);
});
