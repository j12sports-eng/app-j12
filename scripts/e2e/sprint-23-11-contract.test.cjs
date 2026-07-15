const assert = require("node:assert/strict");
const test = require("node:test");

const { JOURNEYS } = require("../../e2e/sprint-23-11/journey-catalog.cjs");

test("catalog preserves the 21 canonical Sprint 22.10 journeys", () => {
  assert.equal(JOURNEYS.length, 21);
  assert.deepEqual(
    JOURNEYS.map((journey) => journey.id),
    Array.from({ length: 21 }, (_, index) => `J${String(index + 1).padStart(2, "0")}`),
  );
  assert.equal(new Set(JOURNEYS.map((journey) => journey.name)).size, 21);
});

test("every journey declares role, UI route, synthetic data, expected result and dependencies", () => {
  for (const journey of JOURNEYS) {
    assert.match(journey.role, /^(admin|professor|aluno|responsavel|public)$/);
    assert.match(journey.route, /^\//);
    assert.match(journey.data, /SYNTHETIC/);
    assert.ok(journey.expected.length > 5);
    for (const dependency of journey.dependencies) {
      assert.ok(JOURNEYS.some((candidate) => candidate.id === dependency));
      assert.ok(Number(dependency.slice(1)) < Number(journey.id.slice(1)));
    }
  }
});

test("browser suite no longer contains the obsolete migration blocker", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const suite = fs.readFileSync(
    path.resolve(__dirname, "../../e2e/sprint-23-11/journeys.spec.cjs"),
    "utf8",
  );
  assert.doesNotMatch(suite, /people before that table is created/);
  assert.match(suite, /IMPLEMENTED = new Set\(Object\.keys\(HANDLERS\)\)/);
  for (const id of Array.from(
    { length: 21 },
    (_, index) => `J${String(index + 1).padStart(2, "0")}`,
  )) {
    assert.match(suite, new RegExp(`${id}:`));
  }
  assert.doesNotMatch(suite, /BLOCKED: journey implementation is pending/);
  assert.match(suite, /await page\.context\(\)\.route\("\*\*\/\*"/);
  assert.match(suite, /await route\.abort\("blockedbyclient"\)/);
});

test("final runner isolates evidence and owns its three local ports", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const runner = fs.readFileSync(path.resolve(__dirname, "./sprint-23-11-runner.cjs"), "utf8");
  const playwrightConfig = fs.readFileSync(
    path.resolve(__dirname, "../../playwright.config.cjs"),
    "utf8",
  );

  assert.match(runner, /const RUN_NAME = process\.env\.E2E_RUN_NAME \|\| "sprint-23-11b-final"/);
  assert.match(runner, /path\.join\(ARTIFACTS_ROOT, "runs", RUN_NAME\)/);
  assert.match(runner, /path\.join\(ARTIFACTS_ROOT, "mysql-data-" \+ RUN_NAME\)/);
  assert.doesNotMatch(runner, /"mysql-data-sprint-23-11b"\)/);
  assert.match(runner, /E2E_ARTIFACTS_DIR: path\.join\(ARTIFACTS, "playwright"\)/);
  assert.match(runner, /const LOCAL_PORTS = \[3000, 3101, 3307\]/);
  assert.match(runner, /"--port",\s*"3000",\s*"--strictPort"/);
  assert.match(runner, /await waitForPortsFree\(LOCAL_PORTS, 15_000\)/);
  assert.match(playwrightConfig, /process\.env\.E2E_ARTIFACTS_DIR/);
});
