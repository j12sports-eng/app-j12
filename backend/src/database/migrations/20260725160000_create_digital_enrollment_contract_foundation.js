#!/usr/bin/env node
/**
 * Sprint 29.1F.3 foundation. Manual execution only; no template backfill or legacy import.
 */
let dbModule;
const getDb = () => (dbModule ||= require("../../config/db.js"));
const CREATE_CONTRACT_FOUNDATION_SQL = `
CREATE TABLE IF NOT EXISTS digital_enrollment_contract_templates (
  id VARCHAR(64) NOT NULL,
  unit_id VARCHAR(64) NOT NULL,
  name VARCHAR(191) NOT NULL,
  version VARCHAR(32) NOT NULL,
  status ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  content_format ENUM('HTML_SANITIZED') NOT NULL,
  content LONGTEXT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  schema_version INT UNSIGNED NOT NULL DEFAULT 1,
  effective_from DATETIME NULL,
  effective_until DATETIME NULL,
  published_at DATETIME NULL,
  published_by_auth_identity_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE INDEX ux_dect_unit_name_version (unit_id,name,version),
  INDEX idx_dect_status_effective (status,effective_from,effective_until),
  INDEX idx_dect_hash (content_hash),
  CONSTRAINT fk_dect_publisher FOREIGN KEY (published_by_auth_identity_id) REFERENCES auth_identities(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS digital_enrollment_contracts (
  id VARCHAR(64) NOT NULL,
  enrollment_id VARCHAR(64) NOT NULL,
  template_id VARCHAR(64) NOT NULL,
  template_version VARCHAR(32) NOT NULL,
  responsible_relationship_id VARCHAR(64) NOT NULL,
  status ENUM('PENDING_ACCEPTANCE','ACCEPTED','SUPERSEDED','CANCELLED') NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
  content_snapshot LONGTEXT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  generated_at DATETIME NOT NULL,
  expires_at DATETIME NULL,
  accepted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE INDEX ux_dec_enrollment_template_version (enrollment_id,template_id,template_version),
  INDEX idx_dec_enrollment_status (enrollment_id,status),
  INDEX idx_dec_relationship (responsible_relationship_id),
  INDEX idx_dec_hash (content_hash),
  CONSTRAINT fk_dec_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_dec_template FOREIGN KEY (template_id) REFERENCES digital_enrollment_contract_templates(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_dec_relationship FOREIGN KEY (responsible_relationship_id) REFERENCES person_relationships(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS digital_enrollment_contract_acceptances (
  id VARCHAR(64) NOT NULL,
  enrollment_contract_id VARCHAR(64) NOT NULL,
  enrollment_id VARCHAR(64) NOT NULL,
  responsible_relationship_id VARCHAR(64) NOT NULL,
  invitation_id VARCHAR(64) NOT NULL,
  content_hash CHAR(64) NOT NULL,
  accepted_at DATETIME NOT NULL,
  acceptance_method ENUM('ELECTRONIC_CONFIRMATION') NOT NULL,
  terms_version VARCHAR(32) NOT NULL,
  consent_snapshot_json LONGTEXT NOT NULL,
  request_id VARCHAR(96) NULL,
  correlation_id VARCHAR(96) NULL,
  ip_hash CHAR(64) NULL,
  user_agent_hash CHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE INDEX ux_deca_contract (enrollment_contract_id),
  INDEX idx_deca_enrollment (enrollment_id),
  INDEX idx_deca_relationship (responsible_relationship_id),
  INDEX idx_deca_invitation (invitation_id),
  INDEX idx_deca_hash (content_hash),
  CONSTRAINT fk_deca_contract FOREIGN KEY (enrollment_contract_id) REFERENCES digital_enrollment_contracts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_deca_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_deca_relationship FOREIGN KEY (responsible_relationship_id) REFERENCES person_relationships(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_deca_invitation FOREIGN KEY (invitation_id) REFERENCES enrollment_digital_invitations(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;
async function up() {
  const db = getDb();
  for (const table of ["enrollments","person_relationships","enrollment_digital_invitations","auth_identities"]) {
    if (!(await db.tableExists(table))) throw new Error(`Required table ${table} does not exist.`);
  }
  for (const statement of CREATE_CONTRACT_FOUNDATION_SQL.split(";").map((item) => item.trim()).filter(Boolean)) await db.query(statement);
}
async function status() {
  const db = getDb();
  return { acceptances: await db.tableExists("digital_enrollment_contract_acceptances"), contracts: await db.tableExists("digital_enrollment_contracts"), templates: await db.tableExists("digital_enrollment_contract_templates") };
}
if (require.main === module) {
  const command = process.argv[2] || "status";
  (command === "up" ? up() : command === "status" ? status().then(console.log) : Promise.reject(new Error("Use status or up.")))
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(() => dbModule?.pool?.end?.());
}
module.exports = { CREATE_CONTRACT_FOUNDATION_SQL, status, up };
