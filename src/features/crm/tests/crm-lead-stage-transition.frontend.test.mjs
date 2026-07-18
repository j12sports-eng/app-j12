import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("stage frontend exposes PATCH contract and no client scope fields", async () => {
  const api = await readFile(
    new URL("../api/crm-lead-stage-transition.api.ts", import.meta.url),
    "utf8",
  );
  const dialog = await readFile(
    new URL("../components/CrmLeadStageTransitionDialog.tsx", import.meta.url),
    "utf8",
  );
  assert.match(api, /api\.patch/);
  assert.match(api, /\/stage/);
  assert.doesNotMatch(api, /unitId|userId|actorId|metadata/);
  assert.match(dialog, /transitions/);
  assert.match(dialog, /LOST/);
  assert.doesNotMatch(dialog, /drag/i);
});
