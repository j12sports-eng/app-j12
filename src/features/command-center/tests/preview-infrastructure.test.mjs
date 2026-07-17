import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { createPreviewQueryOptions } from "../preview/query-options.ts";
import { createCommandCenterPreviewRegistry } from "../preview/registry.ts";

const feature = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("creates stable preview query options while preserving domain overrides", () => {
  const options = createPreviewQueryOptions(["students", "CURRENT_MONTH"], {
    retry: 2,
    staleTime: 60_000,
  });

  assert.deepEqual(options.queryKey, ["command-center-preview", "students", "CURRENT_MONTH"]);
  assert.equal(options.refetchOnWindowFocus, false);
  assert.equal(options.retry, 2);
  assert.equal(options.staleTime, 60_000);
});

test("registers typed preview definitions without changing their components", () => {
  function FirstPreview() {}
  function SecondPreview() {}
  const definitions = [
    { component: FirstPreview, id: "first", title: "First" },
    { component: SecondPreview, id: "second", title: "Second" },
  ];
  const registry = createCommandCenterPreviewRegistry(definitions);

  assert.equal(registry.get("first")?.component, FirstPreview);
  assert.equal(registry.get("second")?.title, "Second");
  assert.equal(registry.list(), definitions);
});

test("financial preview composes shared infrastructure and keeps domain logic isolated", async () => {
  const component = await readFile(
    path.join(feature, "preview", "FinancialCommandCenterPreview.tsx"),
    "utf8",
  );

  for (const sharedComponent of [
    "PreviewField",
    "PreviewReloadButton",
    "PreviewShell",
    "PreviewStatePanel",
    "createPreviewQueryOptions",
  ]) {
    assert.match(component, new RegExp(sharedComponent));
  }
  assert.doesNotMatch(component, /function (PreviewShell|StatePanel|ReloadButton|PreviewField)/);
  assert.match(component, /financial-preview-normalizer/);
  assert.match(component, /financialPreviewProvider/);
});
