const assert = require("node:assert/strict");
const test = require("node:test");

const migration = require("../../../database/migrations/20260718220000_create_crm_lead_enrollment_conversions.js");
const {
  MIGRATION_DEPENDENCIES,
} = require("../../../database/migration-runner/migration-dependencies.js");
const {
  MySqlCrmLeadEnrollmentConversionRepository,
} = require("../infrastructure/mysql-crm-lead-enrollment-conversion.repository.js");

test("full conversion migration stores ids only and has guarded relationships", () => {
  assert.match(
    migration.CONVERSIONS_SQL,
    /CREATE TABLE IF NOT EXISTS crm_lead_enrollment_conversions/,
  );
  assert.match(
    migration.CONVERSIONS_SQL,
    /UNIQUE KEY ux_crm_lead_enrollment_conversion_lead \(lead_id\)/,
  );
  assert.match(migration.CONVERSIONS_SQL, /FOREIGN KEY \(lead_id\).*REFERENCES crm_leads/is);
  assert.match(migration.CONVERSIONS_SQL, /FOREIGN KEY \(person_id\).*REFERENCES people/is);
  assert.match(
    migration.CONVERSIONS_SQL,
    /FOREIGN KEY \(person_profile_id\).*REFERENCES person_profiles/is,
  );
  assert.match(
    migration.CONVERSIONS_SQL,
    /FOREIGN KEY \(enrollment_id\).*REFERENCES enrollments/is,
  );
  assert.match(migration.CONVERSIONS_SQL, /ON DELETE RESTRICT/g);
  assert.doesNotMatch(migration.CONVERSIONS_SQL, /cpf|email|phone|telefone|nome|birth|nascimento/i);
  assert.deepEqual(
    MIGRATION_DEPENDENCIES["20260718220000_create_crm_lead_enrollment_conversions"],
    [
      "20260629134546_create_enrollments_table",
      "20260718200000_create_crm_lead_student_conversions",
    ],
  );
});

test("full conversion repository locks Lead and persists only operational ids", async () => {
  const calls = [];
  const row = dbRow();
  const repository = repositoryWith(async (sql, params) => {
    calls.push({ params, sql });
    if (sql.startsWith("SELECT id FROM crm_leads")) return [[{ id: "lead-1" }]];
    if (sql.startsWith("SELECT id,lead_id")) {
      const reads = calls.filter((call) => call.sql.startsWith("SELECT id,lead_id")).length;
      return reads > 1 ? [[row]] : [[]];
    }
    if (sql.startsWith("INSERT")) return { affectedRows: 1 };
    return [];
  });
  const result = await repository.create(recordInput());
  assert.equal(result.created, true);
  assert.equal(result.conversion.enrollmentId, "enrollment-1");
  assert.match(calls[0].sql, /FOR UPDATE/);
  assert.match(calls[2].sql, /^INSERT INTO crm_lead_enrollment_conversions/);
  assert.doesNotMatch(JSON.stringify(calls), /52998224725|example\.test/);
});

test("full conversion repository reuses locked record and recovers duplicate", async () => {
  const existing = repositoryWith(async (sql) =>
    sql.startsWith("SELECT id FROM") ? [[{ id: "lead-1" }]] : [[dbRow()]],
  );
  assert.equal((await existing.create(recordInput())).reused, true);

  let conversionReads = 0;
  const duplicate = repositoryWith(async (sql) => {
    if (sql.startsWith("SELECT id FROM")) return [[{ id: "lead-1" }]];
    if (sql.startsWith("SELECT id,lead_id")) return ++conversionReads > 1 ? [[dbRow()]] : [[]];
    if (sql.startsWith("INSERT")) {
      throw Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" });
    }
    return [];
  });
  const recovered = await duplicate.create(recordInput());
  assert.equal(recovered.reused, true);
  assert.equal(recovered.conversion.enrollmentStatus, "DRAFT");
});

function repositoryWith(query) {
  return new MySqlCrmLeadEnrollmentConversionRepository({
    queryRunner: async () => [],
    transactionRunner: async (work) => work({ query }),
  });
}

function recordInput() {
  return {
    convertedAt: "2026-07-18T22:00:00.000Z",
    convertedBy: "user-1",
    enrollmentId: "enrollment-1",
    enrollmentStatus: "DRAFT",
    idempotencyKey: "crm-lead-enrollment:lead-1",
    leadId: "lead-1",
    personId: "person-1",
    personProfileId: "profile-1",
    status: "COMPLETED",
    unitId: "unit-1",
  };
}

function dbRow() {
  return {
    converted_at: "2026-07-18T22:00:00.000Z",
    converted_by: "user-1",
    enrollment_id: "enrollment-1",
    enrollment_status: "DRAFT",
    id: "conversion-1",
    idempotency_key: "crm-lead-enrollment:lead-1",
    lead_id: "lead-1",
    metadata_json: null,
    person_id: "person-1",
    person_profile_id: "profile-1",
    status: "COMPLETED",
    unit_id: "unit-1",
  };
}
