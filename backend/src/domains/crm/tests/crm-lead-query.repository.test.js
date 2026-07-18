const assert = require("node:assert/strict");
const test = require("node:test");
const { MySqlCrmLeadRepository } = require("../infrastructure/mysql-crm-lead.repository.js");

test("internal list repository uses one bounded parameterized query with stable cursor/order", async () => {
  const calls = [];
  const repository = new MySqlCrmLeadRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [[]];
    },
    transactionRunner: async () => {},
  });
  await repository.listLeadsForInternalQuery({
    conversionStatus: "STUDENT_COMPLETED",
    cursor: { createdAt: "2026-07-18T10:00:00.000Z", id: "lead-1" },
    fetchLimit: 51,
    stage: "WON",
    status: "CONVERTED",
    unitId: "unit-1",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.at(-1), 51);
  assert.match(
    calls[0].sql,
    /SELECT l\.id,l\.unit_id,l\.source,l\.assigned_to,l\.stage,l\.status,l\.created_at,l\.updated_at/,
  );
  assert.match(calls[0].sql, /LEFT JOIN crm_lead_student_conversions/);
  assert.match(calls[0].sql, /LEFT JOIN crm_lead_enrollment_conversions/);
  assert.match(calls[0].sql, /ORDER BY l\.created_at DESC,l\.id DESC LIMIT \?/);
  assert.equal(calls[0].sql.includes("SELECT *"), false);
});

test("internal detail repository is one bounded read and supports unit filter", async () => {
  const calls = [];
  const repository = new MySqlCrmLeadRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [[{ id: "lead-1" }]];
    },
    transactionRunner: async () => {},
  });
  assert.deepEqual(
    await repository.findLeadDetailForInternalQuery({ leadId: "lead-1", unitId: "unit-1" }),
    { id: "lead-1" },
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ["lead-1", "unit-1"]);
  assert.match(calls[0].sql, /l\.contact_name,l\.contact_email,l\.contact_phone/);
  assert.match(calls[0].sql, /LIMIT 1$/);
});

test("repository propagates infrastructure failures", async () => {
  const repository = new MySqlCrmLeadRepository({
    queryRunner: async () => {
      throw new Error("database host failure");
    },
    transactionRunner: async () => {},
  });
  await assert.rejects(repository.listLeadsForInternalQuery({}), /database host failure/);
});
