const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationsDirectory = path.resolve(__dirname, "..");

test("migration filenames are timestamped and unique", () => {
  const migrationFiles = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => /\.(?:js|sql)$/.test(file));
  const timestamps = migrationFiles.map((file) => file.slice(0, 14));

  assert.equal(new Set(timestamps).size, timestamps.length);
  migrationFiles.forEach((file) => assert.match(file, /^\d{14}_[a-z0-9_]+\.(?:js|sql)$/));
});

test("both enrollment class-link migrations refuse destructive rollback on populated tables", () => {
  const classLinkMigrations = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith("_add_enrollment_class_links_table.js"));

  assert.equal(
    classLinkMigrations.length,
    2,
    "legacy duplicate remains explicit until HML state is known",
  );

  classLinkMigrations.forEach((file) => {
    const source = fs.readFileSync(path.join(migrationsDirectory, file), "utf8");
    assert.match(source, /SELECT COUNT\(\*\) AS total FROM/);
    assert.match(source, /Refusing to drop/);
  });
});

test("financial and enrollment migrations use DECIMAL and idempotency constraints", () => {
  const obligation = fs.readFileSync(
    path.join(
      migrationsDirectory,
      "20260702120000_create_enrollment_financial_obligations_table.js",
    ),
    "utf8",
  );
  const history = fs.readFileSync(
    path.join(
      migrationsDirectory,
      "20260709220000_create_financial_automation_execution_history.js",
    ),
    "utf8",
  );

  assert.match(obligation, /DECIMAL\(12,\s*2\)/i);
  assert.doesNotMatch(obligation, /\b(?:FLOAT|DOUBLE)\b/i);
  assert.match(
    obligation,
    /UNIQUE INDEX[^\n]+\(enrollment_id, obligation_type\)/i,
    "one obligation type per enrollment is the persistence idempotency key",
  );
  assert.match(history, /PRIMARY KEY \(id\)/i);
  assert.match(history, /INDEX idx_fah_execution \(execution_id\)/i);
});
