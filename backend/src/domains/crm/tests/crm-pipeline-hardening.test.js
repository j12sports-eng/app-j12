const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Lead, LeadStage } = require("../domain/lead.js");
const { CrmLeadService } = require("../application/crm-lead.service.js");
const { MySqlCrmLeadRepository } = require("../infrastructure/mysql-crm-lead.repository.js");
function lead(stage = LeadStage.NEW) { return new Lead({ id: "l1", unitId: "u1", source: "Site", contactName: "Maria", createdBy: "admin", stage }); }
test("application rejects non-serializable and oversized metadata before repository access", async () => {
  let calls = 0; const service = new CrmLeadService({ authorizeUnit: () => true, repository: { async findById() { calls += 1; } } });
  const circular = {}; circular.self = circular;
  await assert.rejects(() => service.moveLeadToStage({ leadId: "l1", nextStage: "CONTACTED", metadata: circular }, { userId: "a", unitId: "u1" }), (error) => error.code === "CRM_METADATA_INVALID");
  await assert.rejects(() => service.moveLeadToStage({ leadId: "l1", nextStage: "CONTACTED", metadata: { value: "x".repeat(4097) } }, { userId: "a", unitId: "u1" }), (error) => error.code === "CRM_METADATA_INVALID");
  assert.equal(calls, 0);
});
test("stale snapshot is rejected after row lock before update or history", async () => {
  const calls = []; const next = lead().moveTo(LeadStage.CONTACTED, { actor: "a" });
  const repo = new MySqlCrmLeadRepository({ queryRunner: async () => [], transactionRunner: async (work) => work({ query: async (sql) => { calls.push(sql); if (sql.includes("FOR UPDATE")) return [[{ ...lead(LeadStage.CONTACTED) }]]; return []; } }) });
  await assert.rejects(() => repo.saveStageTransition({ leadId: "l1", unitId: "u1", expectedStage: "NEW", expectedStatus: "OPEN", next, action: "STAGE_CHANGED", actorId: "a" }), (error) => error.code === "CRM_STAGE_CONFLICT");
  assert.equal(calls.some((sql) => sql.startsWith("UPDATE") || sql.startsWith("INSERT")), false);
});
test("update and history failures propagate through the transaction callback", async () => {
  const next = lead().moveTo(LeadStage.CONTACTED, { actor: "a" });
  for (const failAt of ["UPDATE", "INSERT"]) {
    const repo = new MySqlCrmLeadRepository({ queryRunner: async () => [], transactionRunner: async (work) => work({ query: async (sql) => {
      if (sql.includes("FOR UPDATE")) return [[{ ...lead() }]];
      if (sql.startsWith(failAt)) throw new Error(`${failAt}_FAILED`);
      if (sql.startsWith("UPDATE")) return { affectedRows: 1 };
      return [];
    } }) });
    await assert.rejects(() => repo.saveStageTransition({ leadId: "l1", unitId: "u1", expectedStage: "NEW", expectedStatus: "OPEN", next, action: "STAGE_CHANGED", actorId: "a" }), new RegExp(`${failAt}_FAILED`));
  }
});
test("LOST stage history preserves the required sanitized reason without contact PII", async () => {
  const params = []; const current = lead(); const next = current.moveTo(LeadStage.LOST, { actor: "a", reason: "Sem interesse" });
  const repo = new MySqlCrmLeadRepository({ queryRunner: async () => [], transactionRunner: async (work) => work({ query: async () => [] }) });
  await repo.appendHistory(async (_sql, values) => { params.push(values); }, current, next, "STAGE_CHANGED", "a");
  assert.equal(params[0][9], "Sem interesse"); assert.doesNotMatch(JSON.stringify(params[0]), /Maria|email|phone/);
});
