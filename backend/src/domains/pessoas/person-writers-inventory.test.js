const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  AUDITED_PERSON_WRITERS,
  PERSON_WRITER_CLASSIFICATIONS,
} = require("./person-writers.allowlist.js");

const ROOT = path.resolve(__dirname, "../../../..");
const SCAN_ROOTS = Object.freeze(["backend", "scripts", "src"]);
const SOURCE_EXTENSIONS = new Set([".cjs", ".js", ".mjs", ".sql", ".ts", ".tsx"]);
const DIRECT_PEOPLE_WRITE =
  /\b(INSERT\s+INTO|UPDATE|REPLACE\s+INTO|DELETE\s+FROM)\s+[`"]?people\b/giu;

test("every literal people SQL write remains in the explicit audited allowlist", () => {
  const detected = scanDirectPeopleWrites();
  const allowed = new Map();
  for (const entry of AUDITED_PERSON_WRITERS.filter((candidate) => candidate.directSql)) {
    allowed.set(entry.file, new Set(entry.operations));
  }

  assert.deepEqual(serializeOperations(detected), serializeOperations(allowed));
});

test("allowlist is closed, explicit and references existing repository files", () => {
  const ids = new Set();
  for (const entry of AUDITED_PERSON_WRITERS) {
    assert.equal(PERSON_WRITER_CLASSIFICATIONS.includes(entry.classification), true);
    assert.equal(path.isAbsolute(entry.file), false);
    assert.equal(entry.file.includes("*"), false);
    assert.equal(fs.existsSync(path.join(ROOT, entry.file)), true, entry.file);
    assert.equal(ids.has(entry.id), false, entry.id);
    assert.equal(typeof entry.reason, "string");
    assert.equal(entry.reason.length > 20, true);
    assert.equal(typeof entry.synchronized, "boolean");
    ids.add(entry.id);
  }
});

test("canonical repository writers are synchronized and migration is not operational", () => {
  const operational = AUDITED_PERSON_WRITERS.filter((entry) =>
    entry.id.startsWith("PERSON_REPOSITORY_"),
  );
  assert.equal(operational.length, 3);
  assert.equal(
    operational.every((entry) => entry.classification === "MODERN_SYNCHRONIZED"),
    true,
  );
  assert.equal(
    operational.every((entry) => entry.synchronized),
    true,
  );

  const migration = AUDITED_PERSON_WRITERS.find((entry) => entry.id === "PERSON_IDENTITY_BACKFILL");
  assert.equal(migration.classification, "MIGRATION_ONLY");
});

test("reads and documentation are not classified as operational writers", () => {
  assert.equal(DIRECT_PEOPLE_WRITE.test("SELECT id FROM people"), false);
  DIRECT_PEOPLE_WRITE.lastIndex = 0;
  assert.equal(SCAN_ROOTS.includes("docs"), false);
});

function scanDirectPeopleWrites() {
  const found = new Map();
  for (const root of SCAN_ROOTS) {
    for (const file of walk(path.join(ROOT, root))) {
      if (!SOURCE_EXTENSIONS.has(path.extname(file))) continue;
      const relative = path.relative(ROOT, file).replaceAll("\\", "/");
      const source = fs.readFileSync(file, "utf8");
      DIRECT_PEOPLE_WRITE.lastIndex = 0;
      for (const match of source.matchAll(DIRECT_PEOPLE_WRITE)) {
        const operation = match[1].toUpperCase().startsWith("INSERT")
          ? "INSERT"
          : match[1].toUpperCase().startsWith("REPLACE")
            ? "REPLACE"
            : match[1].toUpperCase().startsWith("DELETE")
              ? "DELETE"
              : "UPDATE";
        const operations = found.get(relative) || new Set();
        operations.add(operation);
        found.set(relative, operations);
      }
    }
  }
  return found;
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["dist", "dist-ssr", "node_modules"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else files.push(absolute);
  }
  return files;
}

function serializeOperations(map) {
  return [...map.entries()]
    .map(([file, operations]) => [file, [...operations].sort()])
    .sort(([left], [right]) => left.localeCompare(right));
}
