#!/usr/bin/env node

/**
 * Sprint 29.1E.1. Manual execution only.
 * Adds canonical responsible ownership and resumable progress without backfill.
 */
const { pool, query, tableExists } = require("../../config/db.js");

const CREATE_PROGRESS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS digital_enrollment_progress (
  id VARCHAR(64) NOT NULL,
  enrollment_id VARCHAR(64) NOT NULL,
  responsible_relationship_id VARCHAR(64) NOT NULL,
  current_step VARCHAR(32) NOT NULL DEFAULT 'RESPONSIBLE_DATA',
  completed_steps_json LONGTEXT NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'NOT_STARTED',
  schema_version INT UNSIGNED NOT NULL DEFAULT 1,
  started_at DATETIME NULL,
  last_saved_at DATETIME NULL,
  ready_for_review_at DATETIME NULL,
  updated_by_invitation_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE INDEX ux_dep_enrollment (enrollment_id),
  INDEX idx_dep_status (status),
  INDEX idx_dep_current_step (current_step),
  INDEX idx_dep_relationship (responsible_relationship_id),
  INDEX idx_dep_invitation (updated_by_invitation_id),
  CONSTRAINT fk_dep_enrollment FOREIGN KEY (enrollment_id)
    REFERENCES enrollments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_dep_relationship FOREIGN KEY (responsible_relationship_id)
    REFERENCES person_relationships(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_dep_invitation FOREIGN KEY (updated_by_invitation_id)
    REFERENCES enrollment_digital_invitations(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const OWNERSHIP_COLUMNS = Object.freeze({
  responsible_person_id: "people",
  responsible_profile_id: "person_profiles",
  responsible_relationship_id: "person_relationships",
});

async function up() {
  for (const table of [
    "enrollments",
    "people",
    "person_profiles",
    "person_relationships",
    "enrollment_digital_invitations",
  ]) {
    if (!(await tableExists(table))) throw new Error(`Required table ${table} does not exist.`);
  }
  const columns = await query(
    "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='enrollments'",
  );
  const existing = new Set(columns.map((column) => column.COLUMN_NAME));
  for (const [column, table] of Object.entries(OWNERSHIP_COLUMNS)) {
    if (!existing.has(column)) {
      await query(`ALTER TABLE enrollments ADD COLUMN ${column} VARCHAR(64) NULL`);
      await query(`ALTER TABLE enrollments ADD INDEX idx_enrollments_${column} (${column})`);
      await query(
        `ALTER TABLE enrollments ADD CONSTRAINT fk_enrollments_${column} FOREIGN KEY (${column}) REFERENCES ${table}(id) ON UPDATE CASCADE ON DELETE RESTRICT`,
      );
    }
  }
  await query(CREATE_PROGRESS_TABLE_SQL);
}

async function status() {
  return { progressTableExists: await tableExists("digital_enrollment_progress") };
}

async function main() {
  const command = process.argv[2] || "status";
  if (command === "up") await up();
  else if (command === "status") console.log(JSON.stringify(await status(), null, 2));
  else throw new Error("Use status or up.");
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool?.end?.();
    });
}

module.exports = {
  CREATE_PROGRESS_TABLE_SQL,
  OWNERSHIP_COLUMNS,
  up,
  status,
};
