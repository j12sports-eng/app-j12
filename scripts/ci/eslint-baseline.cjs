#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
// Overrides are intentionally limited to test fixtures; CI uses the canonical repository paths.
const BASELINE_PATH = process.env.CI_ESLINT_BASELINE_PATH
  ? path.resolve(process.env.CI_ESLINT_BASELINE_PATH)
  : path.join(ROOT, ".ci/eslint-baseline.json");
const REPORT_PATH = process.env.CI_ESLINT_REPORT_PATH
  ? path.resolve(process.env.CI_ESLINT_REPORT_PATH)
  : null;
const write = process.argv.includes("--write");
const report = runEslint();
const current = summarize(report);

if (write) {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), ...current }, null, 2)}\n`,
  );
  process.stdout.write(`ESLint baseline written: ${current.errorCount} errors.\n`);
  process.exit(0);
}

const baseline = readBaseline(BASELINE_PATH);
const regressions = compareSummaries(current, baseline);

process.stdout.write(
  `${JSON.stringify({ baselineErrors: baseline.errorCount, currentErrors: current.errorCount, currentWarnings: current.warningCount, regressions: regressions.length }, null, 2)}\n`,
);
if (regressions.length) {
  process.stderr.write(`${JSON.stringify(regressions.slice(0, 30), null, 2)}\n`);
  process.exit(1);
}

function runEslint() {
  if (REPORT_PATH) return JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
  const eslintCli = path.join(path.dirname(require.resolve("eslint")), "../bin/eslint.js");
  const result = spawnSync(process.execPath, [eslintCli, ".", "--format", "json"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!result.stdout) throw new Error(result.stderr || "ESLint produced no JSON report.");
  return JSON.parse(result.stdout);
}
function summarize(results) {
  let errorCount = 0;
  let warningCount = 0;
  const fingerprints = {};
  const rules = {};
  for (const result of results) {
    const file = path.relative(ROOT, result.filePath).replaceAll("\\", "/");
    errorCount += result.errorCount;
    warningCount += result.warningCount;
    const lines = String(result.source || "").split(/\r?\n/);
    for (const message of result.messages) {
      const rule = message.ruleId || "fatal";
      const source = String(lines[Math.max(0, Number(message.line || 1) - 1)] || "").trim();
      const raw = [file, rule, message.message, source].join("\u0000");
      const fingerprint = crypto.createHash("sha256").update(raw).digest("hex");
      fingerprints[fingerprint] = (fingerprints[fingerprint] || 0) + 1;
      rules[rule] = (rules[rule] || 0) + 1;
    }
  }
  return {
    errorCount,
    warningCount,
    rules: sortObject(rules),
    fingerprints: sortObject(fingerprints),
  };
}
function readBaseline(file) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(
      `Invalid or missing ESLint baseline at ${path.relative(ROOT, file)}: ${error.message}`,
    );
  }
  validateSummary(parsed, "baseline");
  if (parsed.version !== 1)
    throw new Error(`Unsupported ESLint baseline version: ${parsed.version}`);
  return parsed;
}
function validateSummary(summary, label) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary))
    throw new Error(`Invalid ${label}: expected an object.`);
  for (const field of ["errorCount", "warningCount"])
    if (!Number.isInteger(summary[field]) || summary[field] < 0)
      throw new Error(`Invalid ${label}: ${field} must be a non-negative integer.`);
  for (const field of ["rules", "fingerprints"])
    if (!summary[field] || typeof summary[field] !== "object" || Array.isArray(summary[field]))
      throw new Error(`Invalid ${label}: ${field} must be an object.`);
  for (const [fingerprint, count] of Object.entries(summary.fingerprints)) {
    if (!/^[a-f0-9]{64}$/.test(fingerprint) || !Number.isInteger(count) || count < 1)
      throw new Error(`Invalid ${label}: malformed fingerprint entry.`);
  }
  const multiplicity = Object.values(summary.fingerprints).reduce(
    (total, count) => total + count,
    0,
  );
  if (multiplicity !== summary.errorCount + summary.warningCount)
    throw new Error(`Invalid ${label}: fingerprint multiplicity does not match issue totals.`);
}
function compareSummaries(currentSummary, baselineSummary) {
  validateSummary(currentSummary, "current ESLint report");
  validateSummary(baselineSummary, "baseline");
  const regressions = [];
  for (const [fingerprint, count] of Object.entries(currentSummary.fingerprints)) {
    const allowed = baselineSummary.fingerprints[fingerprint] || 0;
    if (count > allowed) regressions.push({ fingerprint, allowed, current: count });
  }
  if (currentSummary.errorCount > baselineSummary.errorCount)
    regressions.push({
      fingerprint: "TOTAL_ERRORS",
      allowed: baselineSummary.errorCount,
      current: currentSummary.errorCount,
    });
  if (currentSummary.warningCount > baselineSummary.warningCount)
    regressions.push({
      fingerprint: "TOTAL_WARNINGS",
      allowed: baselineSummary.warningCount,
      current: currentSummary.warningCount,
    });
  return regressions;
}
function sortObject(object) {
  return Object.fromEntries(
    Object.entries(object).sort(([left], [right]) => left.localeCompare(right)),
  );
}
