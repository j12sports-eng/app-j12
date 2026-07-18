const assert = require("node:assert/strict");
const test = require("node:test");
const { CrmLeadUnitContextService } = require("../application/crm-lead-unit-context.service.js");
const {
  MySqlCrmLeadRepository,
  SELECT_UNIT_CONTEXT,
} = require("../infrastructure/mysql-crm-lead.repository.js");

test("unit context service returns frozen trusted context", async () => {
  const service = new CrmLeadUnitContextService({
    leadRepository: {
      async findUnitContextById() {
        return { id: "lead-1", unit_id: "unit-1" };
      },
    },
  });
  const context = await service.resolve({
    authenticatedUser: { id: "admin-1" },
    authorization: {
      granted: true,
      policy: "GLOBAL_SYSTEM_MANAGEMENT",
      scope: "CRM_INTERNAL_MANAGE",
    },
    correlationId: "correlation-1",
    leadId: "lead-1",
  });
  assert.deepEqual(context, {
    authorization: {
      granted: true,
      policy: "GLOBAL_SYSTEM_MANAGEMENT",
      scope: "CRM_INTERNAL_MANAGE",
    },
    correlationId: "correlation-1",
    unitId: "unit-1",
    userId: "admin-1",
  });
  assert.equal(Object.isFrozen(context), true);
  assert.equal(Object.isFrozen(context.authorization), true);
});

test("repository unit lookup selects only id and unit_id with a parameter", async () => {
  const calls = [];
  const repository = new MySqlCrmLeadRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [[{ id: "lead-1", unit_id: "unit-1" }]];
    },
    transactionRunner: async () => {},
  });
  assert.deepEqual(await repository.findUnitContextById("lead-1"), {
    id: "lead-1",
    unit_id: "unit-1",
  });
  assert.equal(SELECT_UNIT_CONTEXT, "SELECT id, unit_id FROM crm_leads WHERE id = ? LIMIT 1");
  assert.deepEqual(calls, [{ params: ["lead-1"], sql: SELECT_UNIT_CONTEXT }]);
});

test("repository unit lookup returns null when the Lead does not exist", async () => {
  const repository = new MySqlCrmLeadRepository({
    queryRunner: async () => [[]],
    transactionRunner: async () => {},
  });
  assert.equal(await repository.findUnitContextById("missing"), null);
});
