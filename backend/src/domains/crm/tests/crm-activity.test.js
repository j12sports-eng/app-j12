const assert = require("node:assert/strict");
const { test } = require("node:test");
const { ActivityStatus, ActivityType, CrmActivity } = require("../domain/crm-activity.js");
const { CrmActivityService } = require("../application/crm-activity.service.js");
const { MySqlCrmActivityRepository } = require("../infrastructure/mysql-crm-activity.repository.js");
const migration = require("../../../database/migrations/20260717180000_create_crm_activities_table.js");

const NOW = "2026-07-17T18:00:00.000Z";
function input(overrides = {}) { return { leadId:"l1",unitId:"u1",activityType:ActivityType.CALL,subject:"Contato inicial",description:"Conversa comercial",createdBy:"admin",createdAt:NOW,...overrides }; }
function row(overrides = {}) { const a = new CrmActivity(input(overrides)); return { id:a.id,lead_id:a.leadId,unit_id:a.unitId,activity_type:a.activityType,status:a.status,subject:a.subject,description:a.description,scheduled_at:a.scheduledAt,completed_at:a.completedAt,created_at:a.createdAt,created_by:a.createdBy,metadata:JSON.stringify(a.metadata) }; }

test("CALL and EMAIL are created completed while TASK starts pending", () => {
  for (const activityType of [ActivityType.CALL, ActivityType.EMAIL]) {
    const activity = new CrmActivity(input({ activityType }));
    assert.equal(activity.status, ActivityStatus.COMPLETED);
    assert.equal(activity.completedAt, NOW);
  }
  const task = new CrmActivity(input({ activityType:ActivityType.TASK, scheduledAt:"2026-07-18T10:00:00Z" }));
  assert.equal(task.status, ActivityStatus.PENDING);
  assert.equal(task.completedAt, null);
});

test("activity validates subject, type, metadata serialization and immutable identity", () => {
  assert.throws(() => new CrmActivity(input({ subject:"" })), (e) => e.code === "CRM_ACTIVITY_INPUT_INVALID");
  assert.throws(() => new CrmActivity(input({ activityType:"SMS" })), (e) => e.code === "CRM_ACTIVITY_TYPE_INVALID");
  const circular = {}; circular.self = circular;
  assert.throws(() => new CrmActivity(input({ metadata:circular })), (e) => e.code === "CRM_ACTIVITY_METADATA_INVALID");
  assert.throws(() => new CrmActivity(input({ metadata:{ payload:"x".repeat(4097) } })), (e) => e.code === "CRM_ACTIVITY_METADATA_INVALID");
  const metadata = { channel:"manual" };
  const activity = new CrmActivity(input({ metadata })); metadata.channel = "changed";
  assert.deepEqual(activity.metadata, { channel:"manual" });
  assert.ok(Object.isFrozen(activity));
});

test("TASK completes or cancels without changing immutable content", () => {
  const task = new CrmActivity(input({ activityType:ActivityType.TASK }));
  const completed = task.complete("2026-07-18T12:00:00Z");
  assert.equal(completed.status, ActivityStatus.COMPLETED);
  assert.equal(completed.description, task.description);
  assert.equal(completed.leadId, task.leadId);
  assert.equal(task.cancel().status, ActivityStatus.CANCELLED);
  assert.throws(() => completed.complete(), (e) => e.code === "CRM_ACTIVITY_NOT_PENDING");
});

test("service rejects nonexistent lead and delegates valid creation", async () => {
  const service = new CrmActivityService({ authorizeUnit:()=>true, now:()=>new Date(NOW), leadRepository:{ async findById(){ return null; } }, activityRepository:{} });
  await assert.rejects(() => service.createActivity(input(), { userId:"admin" }), (e) => e.code === "CRM_LEAD_NOT_FOUND");
  const valid = new CrmActivityService({ authorizeUnit:()=>true, now:()=>new Date(NOW), leadRepository:{ async findById(){ return { id:"l1" }; } }, activityRepository:{ async createActivity(activity){ return activity; } } });
  const created = await valid.createActivity(input({ createdBy:"ignored" }), { userId:"actor" });
  assert.equal(created.createdBy, "actor");
});

test("repository creates, finds by lead chronologically and lists pending tasks", async () => {
  const calls=[]; const activityRow=row({ activityType:ActivityType.TASK });
  const repository=new MySqlCrmActivityRepository({ transactionRunner:async(work)=>work({query:async()=>[]}), queryRunner:async(sql,params)=>{calls.push({sql,params}); if(sql.startsWith("INSERT")) return {affectedRows:1}; return [[activityRow]];} });
  const activity=new CrmActivity(input({ id:activityRow.id,activityType:ActivityType.TASK }));
  await repository.createActivity(activity);
  const listed=await repository.findByLead({leadId:"l1",unitId:"u1"});
  assert.equal(listed[0].leadId,"l1");
  assert.match(calls.at(-1).sql,/ORDER BY created_at ASC,id ASC/);
  await repository.listPendingTasks({unitId:"u1"});
  assert.match(calls.at(-1).sql,/activity_type='TASK' AND status='PENDING'/);
  assert.doesNotMatch(calls.map((call)=>call.sql).join(" "),/DELETE/i);
});

test("completeTask locks and compare-and-sets exactly once", async () => {
  const calls=[]; const current=row({activityType:ActivityType.TASK}); const completed={...current,status:"COMPLETED",completed_at:NOW};
  const repository=new MySqlCrmActivityRepository({queryRunner:async()=>[],transactionRunner:async(work)=>work({query:async(sql,params)=>{calls.push({sql,params}); if(sql.includes("FOR UPDATE")) return [[current]]; if(sql.startsWith("UPDATE")) return {affectedRows:1}; return [[completed]];}})});
  const result=await repository.completeTask({id:current.id,unitId:"u1",completedAt:NOW});
  assert.equal(result.status,"COMPLETED");
  assert.match(calls[0].sql,/FOR UPDATE/);
  assert.match(calls[1].sql,/status='PENDING'/);
  assert.equal(calls[1].params[0],"COMPLETED");
});

test("concurrent completion, cancellation and rollback failures do not retry or overwrite", async () => {
  const pending=row({activityType:ActivityType.TASK});
  for (const mode of ["stale", "failure"]) {
    let updates=0;
    const repository=new MySqlCrmActivityRepository({queryRunner:async()=>[],transactionRunner:async(work)=>work({query:async(sql)=>{if(sql.includes("FOR UPDATE")) return [[pending]]; if(sql.startsWith("UPDATE")){updates+=1;if(mode==="failure") throw new Error("db failure");return {affectedRows:0};} return [];}})});
    await assert.rejects(() => repository.completeTask({id:pending.id,unitId:"u1",completedAt:NOW}), mode==="stale" ? (e)=>e.code==="CRM_ACTIVITY_CONFLICT" : /db failure/);
    assert.equal(updates,1);
  }
  const repository=new MySqlCrmActivityRepository({queryRunner:async()=>[],transactionRunner:async(work)=>work({query:async(sql)=>sql.includes("FOR UPDATE")?[[pending]]:sql.startsWith("UPDATE")?{affectedRows:1}:[[{...pending,status:"CANCELLED"}]]})});
  assert.equal((await repository.cancelTask({id:pending.id,unitId:"u1"})).status,"CANCELLED");
});

test("migration is idempotent and defines only required indexes and FK", () => {
  assert.match(migration.ACTIVITIES_SQL,/CREATE TABLE IF NOT EXISTS crm_activities/);
  for (const index of ["lead","unit","status","scheduled"]) assert.match(migration.ACTIVITIES_SQL,new RegExp(`idx_crm_activities_${index}`));
  assert.match(migration.ACTIVITIES_SQL,/FOREIGN KEY \(lead_id\) REFERENCES crm_leads/);
  assert.equal(migration.TABLE,"crm_activities");
});
