import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  formatClassesPreviewDate,
  isClassesPreviewEmpty,
  normalizeClassesPreviewSource,
} from "../preview/classes-preview-normalizer.ts";

const feature = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(overrides = {}) {
  return {
    contractVersion: "21.5",
    filters: {
      current: { endDate: "2026-07-31", period: "CURRENT_MONTH", startDate: "2026-07-01" },
    },
    generatedAt: "2026-07-17T12:00:00.000Z",
    kpis: {
      activeClasses: { available: true, value: 12 },
      availableSpots: { available: true, value: 18 },
      fullClasses: { available: true, value: 3 },
      occupancyRate: { available: true, value: 72.5 },
      underutilizedClasses: { available: true, value: 2 },
    },
    table: [{ className: "Sub 12", professorName: "Nome privado" }],
    ...overrides,
  };
}

test("normalizes the real aggregate Classes KPIs and drops operational rows", () => {
  const contract = normalizeClassesPreviewSource(source());
  assert.equal(contract.kpis.activeClasses.value, 12);
  assert.equal(contract.kpis.occupancyRate.value, 72.5);
  assert.equal(contract.kpis.attendanceRate.available, false);
  assert.deepEqual(contract.data?.classes, []);
  assert.equal(contract.source.name, "existing-bi-classes-api");
});

test("handles partial payloads, invalid numbers and invalid dates safely", () => {
  const contract = normalizeClassesPreviewSource(
    source({
      generatedAt: "invalid",
      kpis: {
        activeClasses: { available: true, value: Number.NaN },
        availableSpots: { available: true, value: -1 },
        fullClasses: { available: true, value: Number.POSITIVE_INFINITY },
        occupancyRate: { available: true, value: Number.NEGATIVE_INFINITY },
        underutilizedClasses: { available: false, value: 7 },
      },
    }),
  );
  assert.equal(contract.kpis.activeClasses.value, null);
  assert.equal(contract.kpis.occupancyRate.available, false);
  assert.equal(formatClassesPreviewDate(contract.generatedAt), "—");
  assert.equal(isClassesPreviewEmpty(contract), true);
});

test("recognizes valid aggregate metrics without relying on table rows", () => {
  const contract = normalizeClassesPreviewSource(source({ table: undefined }));
  assert.equal(isClassesPreviewEmpty(contract), false);
  assert.deepEqual(contract.data?.classes, []);
});

test("classes preview reuses shared states and stays GET-only without PII", async () => {
  const [component, provider, api, registry] = await Promise.all([
    readFile(path.join(feature, "preview", "ClassesCommandCenterPreview.tsx"), "utf8"),
    readFile(path.join(feature, "preview", "classes-preview-provider.ts"), "utf8"),
    readFile(path.resolve(feature, "..", "bi", "api", "bi-classes.api.ts"), "utf8"),
    readFile(path.join(feature, "preview", "registered-previews.ts"), "utf8"),
  ]);
  for (const shared of [
    "PreviewField",
    "PreviewReloadButton",
    "PreviewShell",
    "PreviewStatePanel",
    "createPreviewQueryOptions",
    "useClassesBI",
  ])
    assert.match(component, new RegExp(shared));
  assert.match(component, /loading && !contract/);
  assert.match(component, /error && !contract/);
  assert.match(component, /isClassesPreviewEmpty/);
  assert.match(component, /Os dados anteriores foram preservados/);
  assert.match(provider, /getBiClasses/);
  assert.match(api, /api\.get<BiClassesContract>/);
  assert.doesNotMatch(api, /api\.(post|put|patch|delete)/i);
  assert.doesNotMatch(component, /professorName|studentName|cpf|email|phone|address/i);
  assert.ok(registry.indexOf('id: "enrollments"') < registry.indexOf('id: "classes"'));
});
