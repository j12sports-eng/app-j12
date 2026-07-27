#!/usr/bin/env node

/**
 * Sprint 31.9. Manual execution only.
 * Creates current state, immutable decision history and durable idempotency
 * storage for digital enrollment administrative reviews.
 */
let dbModule;
const getDb = () => (dbModule ||= require("../../config/db.js"));

const REVIEWS_TABLE = "digital_enrollment_administrative_reviews";
const DECISIONS_TABLE =
  "digital_enrollment_administrative_review_decisions";
const COMMANDS_TABLE =
  "digital_enrollment_administrative_review_commands";

const CREATE_REVIEWS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${REVIEWS_TABLE} (
  id VARCHAR(64) NOT NULL,
  enrollment_id VARCHAR(64) NOT NULL,
  responsible_relationship_id VARCHAR(64) NOT NULL,
  status VARCHAR(40) NOT NULL,
  review_round INT UNSIGNED NOT NULL DEFAULT 1,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  submitted_at DATETIME(3) NOT NULL,
  decided_at DATETIME(3) NULL,
  decision_code VARCHAR(64) NULL,
  decision_reason TEXT NULL,
  reviewer_auth_identity_id VARCHAR(64) NULL,
  correction_items_json LONGTEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX ux_dear_enrollment (enrollment_id),
  INDEX idx_dear_relationship (responsible_relationship_id),
  INDEX idx_dear_status (status),
  INDEX idx_dear_updated_at (updated_at),
  CONSTRAINT fk_dear_enrollment
    FOREIGN KEY (enrollment_id)
    REFERENCES enrollments(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_dear_relationship
    FOREIGN KEY (responsible_relationship_id)
    REFERENCES person_relationships(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const CREATE_DECISIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${DECISIONS_TABLE} (
  id VARCHAR(64) NOT NULL,
  review_id VARCHAR(64) NOT NULL,
  enrollment_id VARCHAR(64) NOT NULL,
  command_id VARCHAR(64) NOT NULL,
  review_round INT UNSIGNED NOT NULL,
  status VARCHAR(40) NOT NULL,
  decision_code VARCHAR(64) NULL,
  decision_reason TEXT NULL,
  reviewer_auth_identity_id VARCHAR(64) NULL,
  correction_items_json LONGTEXT NOT NULL,
  decided_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_deard_review (review_id),
  INDEX idx_deard_enrollment (enrollment_id),
  INDEX idx_deard_status (status),
  INDEX idx_deard_decided_at (decided_at),
  INDEX idx_deard_command (command_id),
  CONSTRAINT fk_deard_review
    FOREIGN KEY (review_id)
    REFERENCES ${REVIEWS_TABLE}(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_deard_enrollment
    FOREIGN KEY (enrollment_id)
    REFERENCES enrollments(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const CREATE_COMMANDS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${COMMANDS_TABLE} (
  command_id VARCHAR(64) NOT NULL,
  operation VARCHAR(64) NOT NULL,
  enrollment_id VARCHAR(64) NOT NULL,
  fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  review_id VARCHAR(64) NOT NULL,
  result_revision INT UNSIGNED NOT NULL,
  result_status VARCHAR(40) NOT NULL,
  result_snapshot_json LONGTEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (command_id),
  INDEX idx_dearc_enrollment (enrollment_id),
  INDEX idx_dearc_review (review_id),
  INDEX idx_dearc_created_at (created_at),
  CONSTRAINT fk_dearc_enrollment
    FOREIGN KEY (enrollment_id)
    REFERENCES enrollments(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_dearc_review
    FOREIGN KEY (review_id)
    REFERENCES ${REVIEWS_TABLE}(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

async function up() {
  const db = getDb();

  for (const table of ["enrollments", "person_relationships"]) {
    if (!(await db.tableExists(table))) {
      throw new Error(`Required table ${table} does not exist.`);
    }
  }

  await db.query(CREATE_REVIEWS_TABLE_SQL);
  await db.query(CREATE_DECISIONS_TABLE_SQL);
  await db.query(CREATE_COMMANDS_TABLE_SQL);
}

async function down() {
  const db = getDb();
  const tables = [COMMANDS_TABLE, DECISIONS_TABLE, REVIEWS_TABLE];

  for (const table of tables) {
    if (!(await db.tableExists(table))) continue;

    const rows = await db.query(
      `SELECT COUNT(*) AS total FROM ${table}`,
    );
    const total = Number(rows[0]?.total ?? 0);

    if (total > 0) {
      throw new Error(
        `Refusing to drop ${table}: table contains ${total} row(s).`,
      );
    }
  }

  for (const table of tables) {
    await db.query(`DROP TABLE IF EXISTS ${table}`);
  }
}

async function status() {
  const db = getDb();

  return {
    reviewsTableExists: await db.tableExists(REVIEWS_TABLE),
    decisionsTableExists: await db.tableExists(DECISIONS_TABLE),
    commandsTableExists: await db.tableExists(COMMANDS_TABLE),
  };
}

async function main() {
  const command = process.argv[2] || "status";

  if (command === "up") {
    await up();
  } else if (command === "down") {
    await down();
  } else if (command === "status") {
    console.log(JSON.stringify(await status(), null, 2));
  } else {
    throw new Error("Use status, up or down.");
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await dbModule?.pool?.end?.();
    });
}

module.exports = {
  CREATE_COMMANDS_TABLE_SQL,
  CREATE_DECISIONS_TABLE_SQL,
  CREATE_REVIEWS_TABLE_SQL,
  down,
  status,
  up,
};
