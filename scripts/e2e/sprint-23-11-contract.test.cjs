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
  assert.match(suite, /IMPLEMENTED = new Set\(\["J01"\]\)/);
});
