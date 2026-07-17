import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const feature = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("enrollment preview reuses the shared vertical integration and all standard states", async () => {
  const component = await readFile(
    path.join(feature, "preview", "EnrollmentCommandCenterPreview.tsx"),
    "utf8",
  );

  for (const shared of [
    "PreviewField",
    "PreviewReloadButton",
    "PreviewShell",
    "PreviewStatePanel",
    "createPreviewQueryOptions",
    "useStudentsBI",
    "studentsPreviewProvider",
  ]) {
    assert.match(component, new RegExp(shared));
  }

  assert.match(component, /loading && !contract/);
  assert.match(component, /error && !contract/);
  assert.match(component, /Os dados anteriores foram preservados/);
  assert.match(component, /!hasMetric && !hasEvolution/);
  assert.match(component, /fetching \? "Atualizando dados…"/);
  assert.doesNotMatch(component, /function (PreviewShell|StatePanel|ReloadButton|PreviewField)/);
});

test("enrollment preview exposes only aggregate enrollment metrics", async () => {
  const component = await readFile(
    path.join(feature, "preview", "EnrollmentCommandCenterPreview.tsx"),
    "utf8",
  );

  assert.match(component, /activeEnrollments/);
  assert.match(component, /newEnrollments/);
  assert.doesNotMatch(component, /studentName|studentCpf|studentEmail|studentPhone|address/i);
  assert.doesNotMatch(component, /confirmDraftEnrollment|api\.(post|put|patch|delete)/i);
});

test("provider source remains GET-only and the registry preserves existing previews", async () => {
  const [api, provider, registry] = await Promise.all([
    readFile(path.resolve(feature, "..", "bi", "api", "bi-students.api.ts"), "utf8"),
    readFile(path.join(feature, "preview", "students-preview-provider.ts"), "utf8"),
    readFile(path.join(feature, "preview", "registered-previews.ts"), "utf8"),
  ]);

  assert.match(provider, /getBiStudents/);
  assert.match(api, /api\.get<BiStudentsContract>/);
  assert.doesNotMatch(api, /api\.(post|put|patch|delete)/i);
  assert.ok(registry.indexOf('id: "financial"') < registry.indexOf('id: "students"'));
  assert.ok(registry.indexOf('id: "students"') < registry.indexOf('id: "enrollments"'));
});
