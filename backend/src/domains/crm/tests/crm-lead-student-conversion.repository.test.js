const assert = require("node:assert/strict");
const test = require("node:test");

const migration = require("../../../database/migrations/20260718200000_create_crm_lead_student_conversions.js");
const {
  MIGRATION_DEPENDENCIES,
} = require("../../../database/migration-runner/migration-dependencies.js");
const {
  MySqlCrmLeadStudentConversionRepository,
} = require("../infrastructure/mysql-crm-lead-student-conversion.repository.js");

test("conversion migration is non-PII, unique by Lead and guarded", () => {
  assert.match(
    migration.CONVERSIONS_SQL,
    /CREATE TABLE IF NOT EXISTS crm_lead_student_conversions/,
  );
  assert.match(
    migration.CONVERSIONS_SQL,
    /UNIQUE KEY ux_crm_lead_student_conversion_lead \(lead_id\)/,
  );
  assert.match(migration.CONVERSIONS_SQL, /FOREIGN KEY \(lead_id\).*REFERENCES crm_leads/is);
  assert.match(migration.CONVERSIONS_SQL, /FOREIGN KEY \(person_id\).*REFERENCES people/is);
  assert.match(
    migration.CONVERSIONS_SQL,
    /FOREIGN KEY \(person_profile_id\).*REFERENCES person_profiles/is,
  );
  assert.doesNotMatch(migration.CONVERSIONS_SQL, /cpf|email|phone|telefone|nome|birth|nascimento/i);
  assert.deepEqual(MIGRATION_DEPENDENCIES["20260718200000_create_crm_lead_student_conversions"], [
    "20260712183000_create_people_domain_tables",
    "20260717150000_create_crm_foundation_tables",
  ]);
});

test("repository locks Lead, checks conversion, inserts and returns it", async () => {
  const calls = [];
  const row = dbRow();
  const repository = repositoryWith(async (sql, params) => {
    calls.push({ params, sql });
    if (sql.startsWith("SELECT id FROM crm_leads")) return [[{ id: "lead-1" }]];
    if (sql.startsWith("SELECT id,lead_id"))
      return calls.filter((call) => call.sql.startsWith("SELECT id,lead_id")).length > 1
        ? [[row]]
        : [[]];
    if (sql.startsWith("INSERT")) return { affectedRows: 1 };
    return [];
  });
  const result = await repository.create(recordInput());
  assert.equal(result.created, true);
  assert.equal(result.conversion.personProfileId, "profile-1");
  assert.match(calls[0].sql, /FOR UPDATE/);
  assert.match(calls[2].sql, /^INSERT INTO crm_lead_student_conversions/);
  assert.doesNotMatch(JSON.stringify(calls), /52998224725|example\.test/);
});

test("repository reuses conversion inside Lead lock and handles duplicate recovery", async () => {
  const existing = repositoryWith(async (sql) =>
    sql.startsWith("SELECT id FROM") ? [[{ id: "lead-1" }]] : [[dbRow()]],
  );
  assert.equal((await existing.create(recordInput())).reused, true);

  let conversionReads = 0;
  const duplicate = repositoryWith(async (sql) => {
    if (sql.startsWith("SELECT id FROM")) return [[{ id: "lead-1" }]];
    if (sql.startsWith("SELECT id,lead_id")) return ++conversionReads > 1 ? [[dbRow()]] : [[]];
    if (sql.startsWith("INSERT"))
      throw Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" });
    return [];
  });
  const recovered = await duplicate.create(recordInput());
  assert.equal(recovered.reused, true);
  assert.equal(recovered.conversion.leadId, "lead-1");
});

function repositoryWith(query) {
  return new MySqlCrmLeadStudentConversionRepository({
    queryRunner: async () => [],
    transactionRunner: async (work) => work({ query }),
  });
}
function recordInput() {
  return {
    leadId: "lead-1",
    unitId: "unit-1",
    personId: "person-1",
    personProfileId: "profile-1",
    convertedBy: "user-1",
    convertedAt: "2026-07-18T20:00:00.000Z",
    idempotencyKey: "crm-lead-student:lead-1",
    status: "COMPLETED",
  };
}
function dbRow() {
  return {
    id: "conversion-1",
    lead_id: "lead-1",
    unit_id: "unit-1",
    person_id: "person-1",
    person_profile_id: "profile-1",
    status: "COMPLETED",
    converted_by: "user-1",
    converted_at: "2026-07-18T20:00:00.000Z",
    idempotency_key: "crm-lead-student:lead-1",
    metadata_json: null,
  };
}
