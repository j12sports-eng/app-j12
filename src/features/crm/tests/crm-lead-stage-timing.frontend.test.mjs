import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

test("timing API, query keys and mutation invalidations remain centralized", async () => {
  const [api, keys, hooks] = await Promise.all([
    source("src/features/crm/api/crm-lead-stage-timing.api.ts"),
    source("src/features/crm/query/crm-lead-stage-timing.query-keys.ts"),
    source("src/features/crm/hooks/use-crm-leads.ts"),
  ]);
  assert.match(api, /\/stage-timing/);
  assert.match(keys, /crmLeadStageTimingQueryKeys/);
  assert.match(keys, /crmLeadSlaQueryKeys/);
  assert.match(hooks, /crmLeadStageTimingQueryKeys\.detail/);
  assert.match(hooks, /crmLeadSlaQueryKeys\.all/);
});

test("cards expose text states, partial coverage and accessible SLA labels", async () => {
  const [card, badge] = await Promise.all([
    source("src/features/crm/components/PipelineCard.tsx"),
    source("src/features/crm/components/CrmLeadSlaBadge.tsx"),
  ]);
  assert.match(card, /Tempo na etapa/);
  assert.match(card, /Dados parciais/);
  for (const label of ["No prazo", "Próximo do prazo", "Atrasado", "SLA não configurado"])
    assert.match(badge, new RegExp(label));
  assert.match(badge, /aria-label/);
});

test("detail handles loading, failure, unavailable history and timeline without reason/PII", async () => {
  const details = await source("src/features/crm/components/CrmLeadStageTimingDetails.tsx");
  assert.match(details, /SkeletonCard/);
  assert.match(details, /role="alert"/);
  assert.match(details, /Sem histórico de etapas disponível/);
  assert.match(details, /Timeline/);
  assert.doesNotMatch(details, /contact|email|telefone|reason/i);
});

test("visual clock advances every 60 seconds and pauses while hidden", async () => {
  const hook = await source("src/features/crm/hooks/use-crm-lead-stage-timing.ts");
  assert.match(hook, /60_000/);
  assert.match(hook, /visibilityState === "visible"/);
  assert.match(hook, /visibilitychange/);
  assert.doesNotMatch(hook, /1_000/);
});
