const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { promises: fs } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { discoverMigrationCatalog } = require("./migration-catalog.js");

const PRESERVED_CHECKSUMS = Object.freeze({
  "20260629134546_create_enrollments_table":
    "0f0e8a713af0b20138519b007d24dbc5d7ddf55b4ea4f230be14bd2bf1609115",
  "20260712183000_create_people_domain_tables":
    "0dfbca2723adac1d906769e1bd12b40ca9d486fafdab2a03529fffc6945609d3",
  "20260629190607_add_active_draft_unique_constraint_to_enrollments":
    "67e96a77c32e2477c7b23ee58eccb651bc72e07a222e0a77b4e4a91a2c524b1a",
  "20260629232350_add_enrollment_confirmation_audit_columns":
    "e0c4cb886c96690c1c5b1ea27f209b56869573553a89351a672608d411f8510c",
  "20260701103000_add_enrollment_class_links_table":
    "c409b99ec23ca23ccc044a7da1d73abc160f4aa329799fefabaa389307c7f96e",
  "20260701120000_add_enrollment_class_links_table":
    "d18f38c57747459782c7ca20220fb520f3fff50ee4e743df0d44588d40debb70",
  "20260702120000_create_enrollment_financial_obligations_table":
    "a12c5e6af7b0441951fc9d9b1586c842b321e93701f053ee9b3e3e945659cf92",
  "20260702133000_create_enrollment_agenda_items_table":
    "6cd128d59b6169e16a46d91219ccd2c92d16db2754acbf33bd6bae5a85c41c8e",
  "20260703130000_create_agenda_recurrence_tables":
    "be981acab4de5c2c735b0de1bcafb6d49396608cae712eb9f8e66f6dabc8c8a3",
  "20260703143000_create_agenda_notification_tables":
    "b83fcbd0edb59fd3e0369d46a9a1db8cbb0274a952902ac1b12fb082e398eb50",
  "20260709220000_create_financial_automation_execution_history":
    "388b17b35800a0feb280ef6c7e8699bda99392532ed7749184443c541732d27f",
  "20260712184500_create_auth_runtime_tables":
    "c50b48b4c2072991a8b135240fd97ca535889a2cf5d5b0f3dabab16723cd875e",
});

test("canonical topology places every declared dependency before its consumer", async () => {
  const catalog = await discoverMigrationCatalog();
  const position = new Map(catalog.map((migration, index) => [migration.id, index]));
  for (const migration of catalog) {
    for (const dependency of migration.dependencies) {
      assert.ok(position.has(dependency), `missing dependency ${dependency}`);
      assert.ok(position.get(dependency) < position.get(migration.id));
    }
  }
});

test("preserved migrations retain their audited byte-level checksums", async () => {
  assert.equal(Object.keys(PRESERVED_CHECKSUMS).length, 12);
  const directory = path.resolve(__dirname, "..", "migrations");
  for (const [id, expected] of Object.entries(PRESERVED_CHECKSUMS)) {
    const entries = await fs.readdir(directory);
    const fileName = entries.find((entry) => entry.startsWith(`${id}.`));
    assert.ok(fileName, `missing preserved migration ${id}`);
    const content = await fs.readFile(path.join(directory, fileName));
    assert.equal(createHash("sha256").update(content).digest("hex"), expected);
  }
});

test("classes foundation precedes every structural consumer of j12_turmas", async () => {
  const catalog = await discoverMigrationCatalog();
  const position = new Map(catalog.map((migration, index) => [migration.id, index]));
  const foundation = position.get("20260713100000_create_classes_foundation_table");
  for (const consumer of [
    "20260701103000_add_enrollment_class_links_table",
    "20260701120000_add_enrollment_class_links_table",
    "20260702133000_create_enrollment_agenda_items_table",
    "20260703130000_create_agenda_recurrence_tables",
  ])
    assert.ok(foundation < position.get(consumer), `foundation must precede ${consumer}`);
});
