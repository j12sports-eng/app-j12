const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const SCRIPT = path.join(__dirname, "eslint-baseline.cjs");

test("progressive baseline enforces fingerprint identity and multiplicity", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "j12-eslint-baseline-"));
  const baseline = path.join(fixture, "baseline.json");
  const report = path.join(fixture, "report.json");
  const original = issues([issue("old-a"), issue("old-b"), issue("duplicate"), issue("duplicate")]);
  try {
    writeReport(report, original);
    assert.equal(run(report, baseline, ["--write"]).status, 0, "explicit --write creates baseline");
    assert.equal(run(report, baseline).status, 0, "current state passes");

    writeReport(report, issues([issue("old-a"), issue("duplicate"), issue("duplicate")]));
    assert.equal(run(report, baseline).status, 0, "removing an old issue passes");

    writeReport(report, issues([...original[0].messages, issue("new-c")]));
    assert.notEqual(run(report, baseline).status, 0, "adding a new issue fails");

    writeReport(
      report,
      issues([issue("old-a"), issue("new-c"), issue("duplicate"), issue("duplicate")]),
    );
    assert.notEqual(run(report, baseline).status, 0, "replacing an old issue with a new one fails");

    writeReport(
      report,
      issues([
        issue("old-a"),
        issue("old-b"),
        issue("duplicate"),
        issue("duplicate"),
        issue("duplicate"),
      ]),
    );
    assert.notEqual(run(report, baseline).status, 0, "increasing fingerprint multiplicity fails");

    writeReport(report, issues([issue("old-a"), issue("old-b"), issue("duplicate")]));
    assert.equal(run(report, baseline).status, 0, "reducing fingerprint multiplicity passes");

    fs.writeFileSync(baseline, "{broken", "utf8");
    assert.notEqual(run(report, baseline).status, 0, "corrupted baseline fails closed");
    fs.rmSync(baseline, { force: true });
    assert.notEqual(run(report, baseline).status, 0, "missing baseline fails without --write");
    assert.equal(
      run(report, baseline, ["--write"]).status,
      0,
      "missing baseline is allowed with --write",
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

function issue(name) {
  return { ruleId: "fixture/rule", severity: 2, message: `fixture ${name}`, line: 1, column: 1 };
}
function issues(messages) {
  return [
    {
      filePath: path.join(ROOT, "fixture.js"),
      errorCount: messages.length,
      warningCount: 0,
      messages,
      source: "fixture source",
    },
  ];
}
function writeReport(file, value) {
  fs.writeFileSync(file, JSON.stringify(value), "utf8");
}
function run(report, baseline, args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CI_ESLINT_REPORT_PATH: report, CI_ESLINT_BASELINE_PATH: baseline },
  });
}
