#!/usr/bin/env node
/**
 * Sprint 29.1F.2. Manual execution only.
 * Stores modern digital-enrollment document metadata; binary content stays in a storage provider.
 */
const { pool, query, tableExists } = require("../../config/db.js");
const CREATE_DOCUMENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS digital_enrollment_documents (
  id VARCHAR(64) NOT NULL,
  enrollment_id VARCHAR(64) NOT NULL,
  responsible_relationship_id VARCHAR(64) NOT NULL,
  type ENUM('CPF','RG','CERTIDAO_NASCIMENTO','COMPROVANTE_RESIDENCIA','FOTO','OUTRO') NOT NULL,
  status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  extension VARCHAR(16) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  storage_key VARCHAR(64) NOT NULL,
  rejection_reason VARCHAR(500) NULL,
  reviewed_at DATETIME NULL,
  reviewed_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE INDEX ux_ded_enrollment_hash (enrollment_id, sha256),
  UNIQUE INDEX ux_ded_storage_key (storage_key),
  INDEX idx_ded_pending (status, created_at),
  INDEX idx_ded_relationship (responsible_relationship_id),
  CONSTRAINT fk_ded_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_ded_progress FOREIGN KEY (enrollment_id) REFERENCES digital_enrollment_progress(enrollment_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_ded_relationship FOREIGN KEY (responsible_relationship_id) REFERENCES person_relationships(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;
async function up() {
  for (const table of ["enrollments", "digital_enrollment_progress", "person_relationships"]) {
    if (!(await tableExists(table))) throw new Error(`Required table ${table} does not exist.`);
  }
  await query(CREATE_DOCUMENTS_TABLE_SQL);
}
async function status() { return { documentsTableExists: await tableExists("digital_enrollment_documents") }; }
async function main() {
  const command = process.argv[2] || "status";
  if (command === "up") await up();
  else if (command === "status") console.log(JSON.stringify(await status(), null, 2));
  else throw new Error("Use status or up.");
}
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool?.end?.());
module.exports = { CREATE_DOCUMENTS_TABLE_SQL, status, up };
