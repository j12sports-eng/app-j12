const assert = require("node:assert/strict");
const test = require("node:test");

const { CrmLeadQueryService } = require("../application/crm-lead-query.service.js");
const {
  CrmLeadSlaAlertQueryService,
} = require("../application/crm-lead-sla-alert-query.service.js");
const { MySqlCrmLeadRepository } = require("../infrastructure/mysql-crm-lead.repository.js");

test("alert page reuses the bounded timing projection in exactly one query without N+1", async () => {
  const calls = [];
  const repository = new MySqlCrmLeadRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [[]];
    },
    transactionRunner: async () => {},
  });
  const leadQueryService = new CrmLeadQueryService({
    clock: { now: () => new Date("2026-07-18T12:00:00Z") },
    repository,
  });
  const service = new CrmLeadSlaAlertQueryService({
    leadQueryService,
    logger: { info() {}, warn() {} },
  });
  await service.listSlaAlerts({ limit: 25, stage: "NEW", unitId: "unit-1" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.at(-1), 26);
  assert.match(calls[0].sql, /AS current_stage_entry_at/);
  assert.match(calls[0].sql, /AS timing_history_stage/);
  assert.match(calls[0].sql, /AS timing_initial_event_reliable/);
  assert.match(calls[0].sql, /ORDER BY l\.created_at DESC,l\.id DESC LIMIT \?/);
  for (const forbidden of ["contact_name", "contact_email", "contact_phone", "reason"]) {
    assert.equal(calls[0].sql.includes(forbidden), false);
  }
});
