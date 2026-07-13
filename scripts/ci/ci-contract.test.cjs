const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const read = (file) => readFile(path.join(ROOT, file), "utf8");

test("CI has no deploy job and covers every mandatory quality gate", async () => {
  const workflow = await read(".github/workflows/quality-gates.yml");
  for (const token of [
    "npm ci",
    "ci:secrets",
    "ci:test:backend",
    "ci:test:frontend",
    "ci:test:security",
    "ci:test:migrations",
    "ci:lint:baseline",
    "ci:quality:changed",
    "npm run build",
    "upload-artifact",
  ])
    assert.match(workflow, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(workflow, /\bdeploy\b|pm2|ssh|production environment/i);
});
test("lint baseline compares fingerprints and total without changing ESLint rules", async () => {
  const source = await read("scripts/ci/eslint-baseline.cjs");
  assert.match(source, /fingerprints/);
  assert.match(source, /currentSummary\.errorCount > baselineSummary\.errorCount/);
  assert.doesNotMatch(source, /--no-ignore|--quiet|eslint-disable/);
});
test("secret scanning blocks sensitive paths and high-confidence credential patterns", async () => {
  const source = await read("scripts/ci/secret-scan.cjs");
  assert.match(source, /forbidden-sensitive-path/);
  assert.match(source, /PRIVATE KEY/);
  assert.match(source, /github-token/);
  assert.match(source, /credential-url/);
});
test("changed quality runs ESLint, Prettier and diff check against explicit base SHA", async () => {
  const source = await read("scripts/ci/changed-quality.cjs");
  assert.match(source, /CI_BASE_SHA/);
  assert.match(source, /core\.quotepath=false/);
  assert.match(source, /"-z"/);
  assert.match(source, /cat-file/);
  assert.match(source, /prettier/);
  assert.match(source, /eslint/);
  assert.match(source, /diff", "--check/);
});
test("workflow resolves pull request, normal push and first-push bases safely", async () => {
  const workflow = await read(".github/workflows/quality-gates.yml");
  assert.match(workflow, /github\.event\.pull_request\.base\.sha/);
  assert.match(workflow, /github\.event\.before/);
  assert.match(workflow, /0000000000000000000000000000000000000000/);
  assert.match(workflow, /git hash-object -t tree \/dev\/null/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /permissions:\s+contents: read/);
});
