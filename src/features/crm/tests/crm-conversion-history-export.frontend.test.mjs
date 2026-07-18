import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const api = fs.readFileSync(
  new URL("../api/crm-conversion-history-export.api.ts", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../pages/CrmConversionHistoryPage.tsx", import.meta.url),
  "utf8",
);

test("CRM history export uses the protected endpoint, current filters and Blob cleanup", () => {
  assert.match(api, /internal\/crm\/conversions\/export/);
  for (const field of [
    "leadId",
    "unitId",
    "convertedBy",
    "enrollmentStatus",
    "dateFrom",
    "dateTo",
  ]) {
    assert.match(api, new RegExp(field));
  }
  assert.doesNotMatch(api, /cursor|limit/);
  assert.match(api, /Authorization/);
  assert.match(api, /response\.blob/);
  assert.match(api, /URL\.revokeObjectURL/);
});

test("CRM history page exposes an accessible non-duplicating export action", () => {
  assert.match(page, /Exportar histórico/);
  assert.match(page, /exportMutation\.isPending/);
  assert.match(page, /aria-live/);
  assert.match(page, /CRM_EXPORT_LIMIT_EXCEEDED/);
});
