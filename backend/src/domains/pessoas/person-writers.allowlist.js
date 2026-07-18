const PERSON_WRITER_CLASSIFICATIONS = Object.freeze([
  "MODERN_SYNCHRONIZED",
  "MODERN_UNSYNCHRONIZED",
  "LEGACY_CONTROLLED",
  "LEGACY_RISKY",
  "DIRECT_SQL",
  "TEST_FIXTURE",
  "MIGRATION_ONLY",
  "EXTERNAL_OR_UNKNOWN",
]);

const AUDITED_PERSON_WRITERS = Object.freeze([
  Object.freeze({
    classification: "MODERN_SYNCHRONIZED",
    directSql: false,
    file: "backend/src/domains/pessoas/person.repository.js",
    id: "PERSON_REPOSITORY_CREATE",
    operations: Object.freeze(["INSERT"]),
    reason:
      "Canonical create persists original and normalized identity in one parameterized statement.",
    synchronized: true,
  }),
  Object.freeze({
    classification: "MODERN_SYNCHRONIZED",
    directSql: false,
    file: "backend/src/domains/pessoas/person.repository.js",
    id: "PERSON_REPOSITORY_UPDATE",
    operations: Object.freeze(["UPDATE"]),
    reason:
      "Canonical full update persists original and normalized identity in one parameterized statement.",
    synchronized: true,
  }),
  Object.freeze({
    classification: "MODERN_SYNCHRONIZED",
    directSql: false,
    file: "backend/src/domains/pessoas/person.repository.js",
    id: "PERSON_REPOSITORY_DELETE",
    operations: Object.freeze(["DELETE"]),
    reason: "Canonical delete changes no surviving identity row.",
    synchronized: true,
  }),
  Object.freeze({
    classification: "MIGRATION_ONLY",
    directSql: false,
    file: "backend/src/database/migrations/20260717220000_add_people_normalized_identity_columns.js",
    id: "PERSON_IDENTITY_BACKFILL",
    operations: Object.freeze(["UPDATE"]),
    reason: "Controlled idempotent migration-only backfill using the canonical normalizer.",
    synchronized: true,
  }),
  Object.freeze({
    classification: "TEST_FIXTURE",
    directSql: true,
    file: "scripts/e2e/sprint-23-11-fixtures.cjs",
    id: "SPRINT_23_11_E2E_PERSON_FIXTURE",
    operations: Object.freeze(["INSERT"]),
    reason: "Synthetic E2E fixture explicitly persists canonical contact normalizations.",
    synchronized: true,
  }),
  Object.freeze({
    classification: "TEST_FIXTURE",
    directSql: true,
    file: "backend/src/database/migrations/tests/people-normalized-identity.migration.test.js",
    id: "PERSON_MIGRATION_FAKE_SQL_FIXTURE",
    operations: Object.freeze(["INSERT", "UPDATE"]),
    reason: "Non-database fake query assertions for migration and repository SQL.",
    synchronized: true,
  }),
  Object.freeze({
    classification: "TEST_FIXTURE",
    directSql: true,
    file: "backend/src/domains/pessoas/person-writers-consistency.test.js",
    id: "PERSON_WRITER_CONSISTENCY_SQL_ASSERTIONS",
    operations: Object.freeze(["INSERT", "UPDATE"]),
    reason: "Non-database assertions proving atomic parameterized repository statements.",
    synchronized: true,
  }),
  Object.freeze({
    classification: "TEST_FIXTURE",
    directSql: true,
    file: "backend/src/domains/pessoas/person-identity-diagnostic.test.js",
    id: "PERSON_DIAGNOSTIC_REJECTION_FIXTURE",
    operations: Object.freeze(["DELETE", "UPDATE"]),
    reason: "Non-executed malicious SQL strings proving the read-only diagnostic guard.",
    synchronized: false,
  }),
]);

module.exports = Object.freeze({ AUDITED_PERSON_WRITERS, PERSON_WRITER_CLASSIFICATIONS });
