const assert = require("node:assert/strict");
const test = require("node:test");
const { CrmLeadQueryService } = require("../application/crm-lead-query.service.js");
const { MySqlCrmLeadRepository } = require("../infrastructure/mysql-crm-lead.repository.js");

test("bounded lead page projects latest timing in one query without N+1", async () => {
  const calls = [];
  const repository = new MySqlCrmLeadRepository({
    queryRunner: async (sql, params) => {
      calls.push({ sql, params });
      return [[]];
    },
    transactionRunner: async () => {},
  });
  await repository.listLeadsForInternalQuery({ fetchLimit: 51 });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /AS current_stage_entry_at/);
  assert.match(calls[0].sql, /AS timing_history_stage/);
  assert.match(calls[0].sql, /AS timing_initial_event_reliable/);
  assert.match(calls[0].sql, /ORDER BY l\.created_at DESC,l\.id DESC LIMIT \?/);
});

test("lead list maps complete current timing and safe NOT_CONFIGURED SLA", async () => {
  const service = new CrmLeadQueryService({
    clock: { now: () => new Date("2026-07-18T12:00:00Z") },
    repository: {
      async listLeadsForInternalQuery() {
        return [
          {
            created_at: "2026-07-18 08:00:00",
            current_stage_entry_at: "2026-07-18 10:00:00",
            id: "lead-1",
            stage: "NEW",
            status: "OPEN",
            timing_history_stage: "NEW",
            timing_initial_event_reliable: 1,
            unit_id: "unit-1",
            updated_at: "2026-07-18 10:00:00",
          },
        ];
      },
      async findLeadDetailForInternalQuery() {},
    },
  });
  const item = (await service.listLeads()).items[0];
  assert.equal(item.stageTiming.historyCoverage, "COMPLETE");
  assert.equal(item.stageTiming.currentStageElapsedMs, 7_200_000);
  assert.equal(item.stageTiming.currentStageEntryAt, "2026-07-18T10:00:00.000Z");
  assert.equal(item.stageTiming.sla.status, "NOT_CONFIGURED");
  assert.equal(item.contact, undefined);
});

test("missing or mismatched latest history is unavailable and never uses lead createdAt", async () => {
  const service = new CrmLeadQueryService({
    clock: { now: () => new Date("2026-07-18T12:00:00Z") },
    repository: {
      async listLeadsForInternalQuery() {
        return [
          {
            created_at: "2026-07-01 08:00:00",
            current_stage_entry_at: "2026-07-18 10:00:00",
            id: "lead-1",
            stage: "QUALIFIED",
            status: "OPEN",
            timing_history_stage: "CONTACTED",
            timing_initial_event_reliable: 1,
            unit_id: "unit-1",
            updated_at: "2026-07-18 10:00:00",
          },
        ];
      },
      async findLeadDetailForInternalQuery() {},
    },
  });
  const timing = (await service.listLeads()).items[0].stageTiming;
  assert.equal(timing.historyCoverage, "UNAVAILABLE");
  assert.equal(timing.currentStageEntryAt, null);
  assert.equal(timing.currentStageElapsedMs, null);
  assert.equal(timing.sla.status, "UNAVAILABLE");
});
