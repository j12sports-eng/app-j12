#!/usr/bin/env node

let database;
function db() {
  return database || (database = require("../../config/db.js"));
}

const TABLE = "crm_lead_student_conversions";
const CONVERSIONS_SQL = `CREATE TABLE IF NOT EXISTS crm_lead_student_conversions (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL,
  unit_id VARCHAR(64) NOT NULL,
  person_id VARCHAR(64) NOT NULL,
  person_profile_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  converted_by VARCHAR(191) NOT NULL,
  converted_at DATETIME NOT NULL,
  idempotency_key VARCHAR(191) NOT NULL,
  metadata_json LONGTEXT NULL,
  UNIQUE KEY ux_crm_lead_student_conversion_lead (lead_id),
  UNIQUE KEY ux_crm_lead_student_conversion_key (idempotency_key),
  INDEX idx_crm_lead_student_conversion_unit (unit_id),
  INDEX idx_crm_lead_student_conversion_person (person_id),
  INDEX idx_crm_lead_student_conversion_profile (person_profile_id),
  CONSTRAINT fk_crm_lead_student_conversion_lead FOREIGN KEY (lead_id)
    REFERENCES crm_leads(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_crm_lead_student_conversion_person FOREIGN KEY (person_id)
    REFERENCES people(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_crm_lead_student_conversion_profile FOREIGN KEY (person_profile_id)
    REFERENCES person_profiles(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

async function up() {
  await db().query(CONVERSIONS_SQL);
  return status();
}

async function status() {
  return { conversions: await db().tableExists(TABLE) };
}

async function down() {
  if (!(await db().tableExists(TABLE))) return;
  const rows = await db().query(`SELECT COUNT(*) total FROM ${TABLE}`);
  if (Number(rows[0]?.total || 0) > 0) {
    throw new Error(`Refusing to drop non-empty ${TABLE}.`);
  }
  await db().query(`DROP TABLE ${TABLE}`);
}

if (require.main === module) {
  const command = process.argv[2] || "status";
  Promise.resolve({ up, down, status }[command]?.())
    .then(console.log)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { CONVERSIONS_SQL, TABLE, down, status, up };
