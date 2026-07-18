import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("pipeline API, query key and hook use the protected read-only contract", () => {
  const api = read("api/crm-pipeline.api.ts");
  const hook = read("hooks/use-crm-pipeline.ts");
  const keys = read("query/crm-pipeline.query-keys.ts");
  assert.match(api, /api\.get<CrmPipeline>\("\/internal\/crm\/pipeline"\)/);
  assert.doesNotMatch(api, /post|put|patch|delete/i);
  assert.match(hook, /useQuery/);
  assert.match(hook, /crmPipelineQueryKeys\.all/);
  assert.match(keys, /\["crmPipeline"\]/);
});

test("Kanban uses reusable columns, cards, header and empty state without drag-and-drop", () => {
  const page = read("pages/CrmLeadsPage.tsx");
  const column = read("components/PipelineColumn.tsx");
  const card = read("components/PipelineCard.tsx");
  for (const component of ["PipelineColumn", "PipelineHeader"]) {
    assert.match(page, new RegExp(component));
  }
  assert.match(column, /PipelineCard/);
  assert.match(column, /PipelineEmptyState/);
  assert.match(column, /leads\.length/);
  assert.match(card, /Lead ID/);
  assert.match(card, /Origem/);
  assert.match(card, /Responsável/);
  assert.match(card, /Última atualização/);
  assert.doesNotMatch(page + column + card, /drag|drop|WebSocket/i);
});

test("pipeline cards consume only the approved non-PII Lead projection", () => {
  const card = read("components/PipelineCard.tsx");
  for (const field of [
    "lead.id",
    "lead.source",
    "lead.assignedTo",
    "lead.status",
    "lead.updatedAt",
  ]) {
    assert.match(card, new RegExp(field.replace(".", "\\.")));
  }
  assert.doesNotMatch(card, /contact|email|phone|telefone|cpf|nome|metadata|payload/i);
});
