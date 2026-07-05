#!/usr/bin/env node

/**
 * Sprint 13.13 - Agenda notification persistence.
 *
 * Manual execution only. Do not run from build, startup or deploy scripts.
 *
 * Usage:
 *   node backend/src/database/migrations/20260703143000_create_agenda_notification_tables.js status
 *   node backend/src/database/migrations/20260703143000_create_agenda_notification_tables.js up
 *   node backend/src/database/migrations/20260703143000_create_agenda_notification_tables.js down
 */

const { pool, query, tableExists } = require("../../config/db.js");

const EVENTS_TABLE_NAME = "agenda_notification_events";
const NOTIFICATIONS_TABLE_NAME = "agenda_notifications";
const QUEUE_TABLE_NAME = "agenda_notification_queue";
const PREFERENCES_TABLE_NAME = "agenda_notification_preferences";
const AUDIT_TABLE_NAME = "agenda_notification_audit_logs";
const AGENDA_ITEMS_TABLE_NAME = "enrollment_agenda_items";
const RECURRENCE_SERIES_TABLE_NAME = "agenda_recurrence_series";

const EVENTS_IDEMPOTENCY_INDEX = "ux_agenda_notification_events_idempotency";
const EVENTS_AGENDA_ITEM_INDEX = "idx_agenda_notification_events_agenda_item";
const EVENTS_SERIES_INDEX = "idx_agenda_notification_events_series";
const EVENTS_TYPE_INDEX = "idx_agenda_notification_events_type";
const QUEUE_IDEMPOTENCY_INDEX = "ux_agenda_notification_queue_idempotency";
const QUEUE_STATUS_INDEX = "idx_agenda_notification_queue_status";
const QUEUE_EVENT_INDEX = "idx_agenda_notification_queue_event";
const QUEUE_RECIPIENT_INDEX = "idx_agenda_notification_queue_recipient";
const NOTIFICATIONS_QUEUE_INDEX = "ux_agenda_notifications_queue";
const NOTIFICATIONS_EVENT_INDEX = "idx_agenda_notifications_event";
const NOTIFICATIONS_RECIPIENT_INDEX = "idx_agenda_notifications_recipient";
const PREFERENCES_RECIPIENT_INDEX = "ux_agenda_notification_preferences_recipient";
const AUDIT_EVENT_INDEX = "idx_agenda_notification_audit_event";
const AUDIT_QUEUE_INDEX = "idx_agenda_notification_audit_queue";
const AUDIT_NOTIFICATION_INDEX = "idx_agenda_notification_audit_notification";

const EVENTS_AGENDA_ITEM_FK = "fk_agenda_notification_events_agenda_item";
const EVENTS_SERIES_FK = "fk_agenda_notification_events_series";
const QUEUE_EVENT_FK = "fk_agenda_notification_queue_event";
const NOTIFICATIONS_EVENT_FK = "fk_agenda_notifications_event";
const NOTIFICATIONS_QUEUE_FK = "fk_agenda_notifications_queue";
const AUDIT_EVENT_FK = "fk_agenda_notification_audit_event";
const AUDIT_QUEUE_FK = "fk_agenda_notification_audit_queue";
const AUDIT_NOTIFICATION_FK = "fk_agenda_notification_audit_notification";

const REQUIRED_TABLES = [
  EVENTS_TABLE_NAME,
  QUEUE_TABLE_NAME,
  NOTIFICATIONS_TABLE_NAME,
  PREFERENCES_TABLE_NAME,
  AUDIT_TABLE_NAME,
];

async function up() {
  await assertPrerequisites();

  for (const [tableName, sql] of [
    [EVENTS_TABLE_NAME, buildCreateEventsTableSql()],
    [QUEUE_TABLE_NAME, buildCreateQueueTableSql()],
    [NOTIFICATIONS_TABLE_NAME, buildCreateNotificationsTableSql()],
    [PREFERENCES_TABLE_NAME, buildCreatePreferencesTableSql()],
    [AUDIT_TABLE_NAME, buildCreateAuditTableSql()],
  ]) {
    if (!(await tableExists(tableName))) {
      await query(sql);
      console.log(`CREATED_TABLE=${tableName}`);
    } else {
      console.log(`SKIP_TABLE_EXISTS=${tableName}`);
    }
  }

  const state = await readState();
  printState(state);
  console.log(`AGENDA_NOTIFICATION_EVENTS_CREATED=${state.eventsTableExists}`);
  console.log(`AGENDA_NOTIFICATIONS_CREATED=${state.notificationsTableExists}`);
  console.log(`AGENDA_NOTIFICATION_QUEUE_CREATED=${state.queueTableExists}`);
  console.log(`AGENDA_NOTIFICATION_PREFERENCES_CREATED=${state.preferencesTableExists}`);
  console.log(`AGENDA_NOTIFICATION_AUDIT_CREATED=${state.auditTableExists}`);
  console.log(`AGENDA_NOTIFICATION_FKS_CREATED=${state.foreignKeysCreated}`);
  console.log(`AGENDA_NOTIFICATION_UNIQUE_KEYS_CREATED=${state.uniqueKeysCreated}`);
  console.log("AGENDA_NOTIFICATION_CHANNELS_PREPARED=IN_APP,WHATSAPP,EMAIL,PUSH");
  console.log("AGENDA_NOTIFICATION_ASYNC_QUEUE_ENABLED=true");
}

async function down() {
  for (const tableName of [
    AUDIT_TABLE_NAME,
    NOTIFICATIONS_TABLE_NAME,
    QUEUE_TABLE_NAME,
    PREFERENCES_TABLE_NAME,
    EVENTS_TABLE_NAME,
  ]) {
    if (!(await tableExists(tableName))) {
      console.log(`SKIP_TABLE_MISSING=${tableName}`);
      continue;
    }

    const rowCount = await countRows(tableName);

    if (rowCount > 0) {
      throw new Error(
        `Refusing to drop ${tableName}: table contains ${rowCount} row(s). Remove data through an approved rollback plan first.`,
      );
    }

    await query(`DROP TABLE ${tableName}`);
    console.log(`DROPPED_TABLE=${tableName}`);
  }
}

async function status() {
  const state = await readState();
  printState(state);
  console.log(`AGENDA_NOTIFICATION_EVENTS_CREATED=${state.eventsTableExists}`);
  console.log(`AGENDA_NOTIFICATIONS_CREATED=${state.notificationsTableExists}`);
  console.log(`AGENDA_NOTIFICATION_QUEUE_CREATED=${state.queueTableExists}`);
  console.log(`AGENDA_NOTIFICATION_PREFERENCES_CREATED=${state.preferencesTableExists}`);
  console.log(`AGENDA_NOTIFICATION_AUDIT_CREATED=${state.auditTableExists}`);
  console.log(`AGENDA_NOTIFICATION_FKS_CREATED=${state.foreignKeysCreated}`);
  console.log(`AGENDA_NOTIFICATION_UNIQUE_KEYS_CREATED=${state.uniqueKeysCreated}`);
}

async function assertPrerequisites() {
  for (const tableName of [AGENDA_ITEMS_TABLE_NAME, RECURRENCE_SERIES_TABLE_NAME]) {
    if (!(await tableExists(tableName))) {
      throw new Error(`Missing required table ${tableName}.`);
    }

    const tableInfo = await readTableInfo(tableName);

    if (String(tableInfo?.ENGINE ?? "").toLowerCase() !== "innodb") {
      throw new Error(`Table ${tableName} must use InnoDB for foreign keys.`);
    }
  }
}

async function readState() {
  const [eventsInfo, queueInfo, notificationsInfo, preferencesInfo, auditInfo] = await Promise.all([
    readTableInfo(EVENTS_TABLE_NAME),
    readTableInfo(QUEUE_TABLE_NAME),
    readTableInfo(NOTIFICATIONS_TABLE_NAME),
    readTableInfo(PREFERENCES_TABLE_NAME),
    readTableInfo(AUDIT_TABLE_NAME),
  ]);
  const tableNames = REQUIRED_TABLES.filter((tableName, index) =>
    Boolean([eventsInfo, queueInfo, notificationsInfo, preferencesInfo, auditInfo][index]),
  );
  const [indexes, foreignKeys, rowCounts] =
    tableNames.length > 0
      ? await Promise.all([
          readIndexes(tableNames),
          readForeignKeys(tableNames),
          readRowCounts(tableNames),
        ])
      : [[], [], []];

  return {
    auditTableExists: Boolean(auditInfo),
    eventsTableExists: Boolean(eventsInfo),
    foreignKeys,
    foreignKeysCreated: hasRequiredForeignKeys(foreignKeys),
    indexes,
    notificationsTableExists: Boolean(notificationsInfo),
    preferencesTableExists: Boolean(preferencesInfo),
    queueTableExists: Boolean(queueInfo),
    rowCounts,
    uniqueKeysCreated: hasRequiredUniqueKeys(indexes),
  };
}

function buildCreateEventsTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS ${EVENTS_TABLE_NAME} (
      id VARCHAR(64) NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      agenda_item_id VARCHAR(64) NULL,
      recurrence_series_id VARCHAR(64) NULL,
      occurrence_key VARCHAR(191) NULL,
      class_id VARCHAR(64) NULL,
      payload_json LONGTEXT NULL,
      actor_id VARCHAR(191) NOT NULL,
      idempotency_key VARCHAR(191) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'RECORDED',
      occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE INDEX ${EVENTS_IDEMPOTENCY_INDEX} (idempotency_key),
      INDEX ${EVENTS_TYPE_INDEX} (event_type),
      INDEX ${EVENTS_AGENDA_ITEM_INDEX} (agenda_item_id),
      INDEX ${EVENTS_SERIES_INDEX} (recurrence_series_id),
      CONSTRAINT ${EVENTS_AGENDA_ITEM_FK}
        FOREIGN KEY (agenda_item_id)
        REFERENCES ${AGENDA_ITEMS_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
      CONSTRAINT ${EVENTS_SERIES_FK}
        FOREIGN KEY (recurrence_series_id)
        REFERENCES ${RECURRENCE_SERIES_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

function buildCreateQueueTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS ${QUEUE_TABLE_NAME} (
      id VARCHAR(64) NOT NULL,
      event_id VARCHAR(64) NOT NULL,
      notification_id VARCHAR(64) NULL,
      recipient_type VARCHAR(32) NOT NULL,
      recipient_id VARCHAR(191) NOT NULL,
      channel VARCHAR(32) NOT NULL,
      title VARCHAR(160) NOT NULL,
      message VARCHAR(500) NOT NULL,
      notification_type VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 3,
      scheduled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME NULL,
      next_attempt_at DATETIME NULL,
      last_error VARCHAR(1000) NULL,
      delivery_json LONGTEXT NULL,
      idempotency_key VARCHAR(191) NOT NULL,
      payload_json LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE INDEX ${QUEUE_IDEMPOTENCY_INDEX} (idempotency_key),
      INDEX ${QUEUE_EVENT_INDEX} (event_id),
      INDEX ${QUEUE_STATUS_INDEX} (status, scheduled_at, next_attempt_at),
      INDEX ${QUEUE_RECIPIENT_INDEX} (recipient_type, recipient_id, created_at),
      CONSTRAINT ${QUEUE_EVENT_FK}
        FOREIGN KEY (event_id)
        REFERENCES ${EVENTS_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

function buildCreateNotificationsTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS ${NOTIFICATIONS_TABLE_NAME} (
      id VARCHAR(64) NOT NULL,
      event_id VARCHAR(64) NOT NULL,
      queue_id VARCHAR(64) NULL,
      recipient_type VARCHAR(32) NOT NULL,
      recipient_id VARCHAR(191) NOT NULL,
      title VARCHAR(160) NOT NULL,
      message VARCHAR(500) NOT NULL,
      notification_type VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'UNREAD',
      read_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE INDEX ${NOTIFICATIONS_QUEUE_INDEX} (queue_id),
      INDEX ${NOTIFICATIONS_EVENT_INDEX} (event_id),
      INDEX ${NOTIFICATIONS_RECIPIENT_INDEX} (recipient_type, recipient_id, read_at, created_at),
      CONSTRAINT ${NOTIFICATIONS_EVENT_FK}
        FOREIGN KEY (event_id)
        REFERENCES ${EVENTS_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      CONSTRAINT ${NOTIFICATIONS_QUEUE_FK}
        FOREIGN KEY (queue_id)
        REFERENCES ${QUEUE_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

function buildCreatePreferencesTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS ${PREFERENCES_TABLE_NAME} (
      id VARCHAR(64) NOT NULL,
      recipient_type VARCHAR(32) NOT NULL,
      recipient_id VARCHAR(191) NOT NULL,
      channel VARCHAR(32) NOT NULL,
      notification_type VARCHAR(64) NOT NULL DEFAULT 'AGENDA',
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      muted_until DATETIME NULL,
      allowed_start VARCHAR(20) NULL,
      allowed_end VARCHAR(20) NULL,
      allowed_types_json LONGTEXT NULL,
      updated_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE INDEX ${PREFERENCES_RECIPIENT_INDEX}
        (recipient_type, recipient_id, channel, notification_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

function buildCreateAuditTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS ${AUDIT_TABLE_NAME} (
      id VARCHAR(64) NOT NULL,
      event_id VARCHAR(64) NULL,
      queue_id VARCHAR(64) NULL,
      notification_id VARCHAR(64) NULL,
      action VARCHAR(64) NOT NULL,
      status VARCHAR(32) NULL,
      recipient_type VARCHAR(32) NULL,
      recipient_id VARCHAR(191) NULL,
      details_json LONGTEXT NULL,
      created_by VARCHAR(191) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX ${AUDIT_EVENT_INDEX} (event_id),
      INDEX ${AUDIT_QUEUE_INDEX} (queue_id),
      INDEX ${AUDIT_NOTIFICATION_INDEX} (notification_id),
      CONSTRAINT ${AUDIT_EVENT_FK}
        FOREIGN KEY (event_id)
        REFERENCES ${EVENTS_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
      CONSTRAINT ${AUDIT_QUEUE_FK}
        FOREIGN KEY (queue_id)
        REFERENCES ${QUEUE_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
      CONSTRAINT ${AUDIT_NOTIFICATION_FK}
        FOREIGN KEY (notification_id)
        REFERENCES ${NOTIFICATIONS_TABLE_NAME} (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

async function readTableInfo(tableName) {
  const rows = await query(
    `
      SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
      LIMIT 1
    `,
    [tableName],
  );

  return rows[0] ?? null;
}

async function readIndexes(tableNames) {
  const placeholders = tableNames.map(() => "?").join(", ");

  return query(
    `
      SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE,
             GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name IN (${placeholders})
      GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
      ORDER BY TABLE_NAME, INDEX_NAME
    `,
    tableNames,
  );
}

async function readForeignKeys(tableNames) {
  const placeholders = tableNames.map(() => "?").join(", ");

  return query(
    `
      SELECT
        kcu.TABLE_NAME,
        kcu.CONSTRAINT_NAME,
        kcu.COLUMN_NAME,
        kcu.REFERENCED_TABLE_NAME,
        kcu.REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE kcu
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME IN (${placeholders})
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
    `,
    tableNames,
  );
}

async function readRowCounts(tableNames) {
  const results = [];

  for (const tableName of tableNames) {
    results.push({ tableName, total: await countRows(tableName) });
  }

  return results;
}

async function countRows(tableName) {
  const rows = await query(`SELECT COUNT(*) AS total FROM ${tableName}`);
  return Number(rows[0]?.total ?? 0);
}

function hasRequiredUniqueKeys(indexes) {
  const uniqueIndexes = new Set(
    (indexes || [])
      .filter((index) => Number(index.NON_UNIQUE) === 0)
      .map((index) => `${index.TABLE_NAME}.${index.INDEX_NAME}:${index.columns}`),
  );

  return (
    uniqueIndexes.has(`${EVENTS_TABLE_NAME}.${EVENTS_IDEMPOTENCY_INDEX}:idempotency_key`) &&
    uniqueIndexes.has(`${QUEUE_TABLE_NAME}.${QUEUE_IDEMPOTENCY_INDEX}:idempotency_key`) &&
    uniqueIndexes.has(`${NOTIFICATIONS_TABLE_NAME}.${NOTIFICATIONS_QUEUE_INDEX}:queue_id`) &&
    uniqueIndexes.has(
      `${PREFERENCES_TABLE_NAME}.${PREFERENCES_RECIPIENT_INDEX}:recipient_type,recipient_id,channel,notification_type`,
    )
  );
}

function hasRequiredForeignKeys(foreignKeys) {
  const names = new Set((foreignKeys || []).map((fk) => fk.CONSTRAINT_NAME));

  return [
    EVENTS_AGENDA_ITEM_FK,
    EVENTS_SERIES_FK,
    QUEUE_EVENT_FK,
    NOTIFICATIONS_EVENT_FK,
    NOTIFICATIONS_QUEUE_FK,
    AUDIT_EVENT_FK,
    AUDIT_QUEUE_FK,
    AUDIT_NOTIFICATION_FK,
  ].every((name) => names.has(name));
}

function printState(state) {
  console.log(JSON.stringify(state, null, 2));
}

async function main() {
  const command = process.argv[2] || "status";

  if (command === "up") {
    await up();
    return;
  }

  if (command === "down") {
    await down();
    return;
  }

  if (command === "status") {
    await status();
    return;
  }

  throw new Error(`Unknown command: ${command}. Use status, up or down.`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (pool && typeof pool.end === "function") {
        await pool.end();
      }
      process.exit(process.exitCode || 0);
    });
}

module.exports = {
  AGENDA_ITEMS_TABLE_NAME,
  AUDIT_TABLE_NAME,
  EVENTS_TABLE_NAME,
  NOTIFICATIONS_TABLE_NAME,
  PREFERENCES_TABLE_NAME,
  QUEUE_TABLE_NAME,
  RECURRENCE_SERIES_TABLE_NAME,
  buildCreateAuditTableSql,
  buildCreateEventsTableSql,
  buildCreateNotificationsTableSql,
  buildCreatePreferencesTableSql,
  buildCreateQueueTableSql,
  down,
  hasRequiredForeignKeys,
  hasRequiredUniqueKeys,
  readState,
  status,
  up,
};
