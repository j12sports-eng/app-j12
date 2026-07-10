import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
test("BI export frontend keeps formats, reports and filters consistent", async () => {
  const api = await readFile(path.join(root, "api", "bi-export.api.ts"), "utf8");
  const page = await readFile(path.join(root, "components", "BiExportsDashboard.tsx"), "utf8");
  assert.match(api, /buildApiUrl/);
  assert.match(api, /getStoredAuthToken/);
  assert.match(api, /clearAuthSession/);
  assert.match(api, /response\.status === 401/);
  assert.match(api, /window\.location\.assign\("\/login"\)/);
  assert.match(api, /response\.blob\(\)/);
  assert.match(api, /filename="\(\[a-z0-9\._-\]\+\)"/);
  assert.match(api, /j12-bi\.\$\{format\}/);
  assert.match(api, /finally/);
  assert.match(api, /URL\.revokeObjectURL/);
  for (const value of [
    "executive",
    "financial",
    "students",
    "classes",
    "delinquency",
    "courts",
    "championships",
    "csv",
    "xlsx",
    "pdf",
    "startDate",
    "endDate",
    "unitId",
  ])
    assert.match(`${api}\n${page}`, new RegExp(value));
  assert.match(page, /5\.000 linhas/);
  assert.match(page, /CUSTOM/);
  assert.match(page, /disabled={!valid \|\| loading}/);
});
