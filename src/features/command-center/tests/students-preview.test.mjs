import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  formatStudentsPreviewDate,
  isStudentsPreviewEmpty,
  normalizeStudentsPreviewSource,
} from "../preview/students-preview-normalizer.ts";

const feature = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(overrides = {}) {
  return {
    contractVersion: "21.4",
    distributions: { ageGroups: [], modalities: [], units: [] },
    evolution: [],
    filters: {
      current: { endDate: "2026-07-31", period: "CURRENT_MONTH", startDate: "2026-07-01" },
      previous: { endDate: "2026-06-30", startDate: "2026-06-01" },
    },
    generatedAt: "2026-07-17T12:00:00.000Z",
    kpis: {
      activeEnrollments: { available: true, value: 41 },
      activeStudents: { available: true, value: 37 },
      newEnrollments: { available: true, value: 4 },
      newStudents: { available: true, value: 3 },
    },
    ...overrides,
  };
}

test("normalizes only supported aggregate student indicators", () => {
  const contract = normalizeStudentsPreviewSource(source());
  assert.equal(contract.kpis.activeStudents.value, 37);
  assert.equal(contract.kpis.newEnrollments.value, 4);
  assert.equal(contract.kpis.churnRate.available, false);
  assert.equal(contract.kpis.cancellations.value, null);
  assert.equal(contract.source.name, "existing-bi-students-api");
});

test("handles partial, invalid and missing student BI values safely", () => {
  const contract = normalizeStudentsPreviewSource(
    source({
      distributions: undefined,
      evolution: undefined,
      generatedAt: "invalid",
      kpis: {
        activeEnrollments: { available: true, value: Number.POSITIVE_INFINITY },
        activeStudents: { available: true, value: -2 },
        newEnrollments: { available: true, value: Number.NaN },
        newStudents: { available: false, value: 9 },
      },
    }),
  );
  assert.equal(contract.kpis.activeStudents.value, null);
  assert.deepEqual(contract.data?.evolution, []);
  assert.deepEqual(contract.data?.distributions, { ageGroups: [], modalities: [], units: [] });
  assert.equal(formatStudentsPreviewDate(contract.generatedAt), "—");
  assert.equal(isStudentsPreviewEmpty(contract), true);
});

test("keeps zero counts empty but recognizes aggregate series", () => {
  const empty = normalizeStudentsPreviewSource(source({ kpis: {} }));
  assert.equal(isStudentsPreviewEmpty(empty), true);
  const withEvolution = normalizeStudentsPreviewSource(
    source({ evolution: [{ newEnrollments: 1, newStudents: 1, period: "2026-07" }], kpis: {} }),
  );
  assert.equal(isStudentsPreviewEmpty(withEvolution), false);
});

test("preview composes shared states and uses the read-only existing API", async () => {
  const [component, provider, registry, api] = await Promise.all([
    readFile(path.join(feature, "preview", "StudentsCommandCenterPreview.tsx"), "utf8"),
    readFile(path.join(feature, "preview", "students-preview-provider.ts"), "utf8"),
    readFile(path.join(feature, "preview", "registered-previews.ts"), "utf8"),
    readFile(path.resolve(feature, "..", "bi", "api", "bi-students.api.ts"), "utf8"),
  ]);
  for (const shared of [
    "PreviewField",
    "PreviewReloadButton",
    "PreviewShell",
    "PreviewStatePanel",
    "createPreviewQueryOptions",
  ])
    assert.match(component, new RegExp(shared));
  assert.match(component, /loading && !contract/);
  assert.match(component, /error && !contract/);
  assert.match(component, /isStudentsPreviewEmpty/);
  assert.match(provider, /getBiStudents/);
  assert.match(api, /\/admin\/bi\/students/);
  assert.doesNotMatch(api, /\.(post|put|patch|delete)\s*\(/i);
  assert.ok(registry.indexOf('id: "financial"') < registry.indexOf('id: "students"'));
  assert.doesNotMatch(component, /email|phone|cpf|birthDate|studentName/i);
});
