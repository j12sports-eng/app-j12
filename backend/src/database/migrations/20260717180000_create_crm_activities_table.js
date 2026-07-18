#!/usr/bin/env node
let database;
function db() { return database || (database = require("../../config/db.js")); }
const TABLE = "crm_activities";
const ACTIVITIES_SQL = `CREATE TABLE IF NOT EXISTS crm_activities (id VARCHAR(64) PRIMARY KEY,lead_id VARCHAR(64) NOT NULL,unit_id VARCHAR(64) NOT NULL,activity_type VARCHAR(32) NOT NULL,status VARCHAR(32) NOT NULL,subject VARCHAR(191) NOT NULL,description TEXT NULL,scheduled_at DATETIME NULL,completed_at DATETIME NULL,created_at DATETIME NOT NULL,created_by VARCHAR(191) NOT NULL,metadata TEXT NULL,INDEX idx_crm_activities_lead (lead_id),INDEX idx_crm_activities_unit (unit_id),INDEX idx_crm_activities_status (status),INDEX idx_crm_activities_scheduled (scheduled_at),CONSTRAINT fk_crm_activities_lead FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE RESTRICT ON UPDATE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
async function up() { await db().query(ACTIVITIES_SQL); return status(); }
async function status() { return { activities: await db().tableExists(TABLE) }; }
async function down() { if (!(await db().tableExists(TABLE))) return; const rows=await db().query(`SELECT COUNT(*) total FROM ${TABLE}`); if(Number(rows[0]?.total||0)>0) throw new Error(`Refusing to drop non-empty ${TABLE}.`); await db().query(`DROP TABLE ${TABLE}`); }
if(require.main===module){ const command=process.argv[2]||"status"; Promise.resolve({up,down,status}[command]?.()).then(console.log).catch((e)=>{console.error(e);process.exitCode=1;}); }
module.exports={ ACTIVITIES_SQL, TABLE, down, status, up };
