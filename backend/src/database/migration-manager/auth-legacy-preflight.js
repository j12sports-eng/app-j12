"use strict";

const AUTH_LEGACY_PREFLIGHT_QUERIES = Object.freeze([
  query("legacy_summary", `
    SELECT COUNT(*) AS total, MAX(id) AS max_id,
      MAX(aluno_id) AS max_aluno_id, MAX(professor_id) AS max_professor_id,
      MAX(responsavel_id) AS max_responsavel_id
    FROM j12_usuarios
  `),
  query("duplicate_emails", `
    SELECT LOWER(TRIM(email)) AS email_key, COUNT(*) AS total
    FROM j12_usuarios
    WHERE email IS NOT NULL AND TRIM(email) <> ''
    GROUP BY LOWER(TRIM(email))
    HAVING COUNT(*) > 1
  `),
  query("empty_emails", `
    SELECT COUNT(*) AS total
    FROM j12_usuarios
    WHERE email IS NULL OR TRIM(email) = ''
  `),
  query("invalid_profiles", `
    SELECT perfil, COUNT(*) AS total
    FROM j12_usuarios
    WHERE perfil IS NULL OR perfil NOT IN ('admin','professor','responsavel','aluno')
    GROUP BY perfil
  `),
  query("null_status", `
    SELECT COUNT(*) AS total FROM j12_usuarios WHERE status IS NULL
  `),
  query("legacy_sessions", `
    SELECT COUNT(*) AS total
    FROM user_sessions s
    INNER JOIN j12_usuarios j
      ON s.user_id = CAST(j.id AS CHAR) OR s.user_id = CONCAT('j12:', j.id)
  `),
  query("id_overlap", `
    SELECT COUNT(*) AS total
    FROM users u INNER JOIN j12_usuarios j ON u.id = CAST(j.id AS CHAR)
  `),
  query("email_collisions", `
    SELECT LOWER(TRIM(j.email)) AS email_key, COUNT(*) AS total
    FROM j12_usuarios j INNER JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(j.email))
    WHERE j.email IS NOT NULL AND TRIM(j.email) <> ''
    GROUP BY LOWER(TRIM(j.email))
  `),
  query("orphan_aluno_ids", `
    SELECT COUNT(*) AS total
    FROM j12_usuarios j LEFT JOIN j12_alunos a ON a.id = j.aluno_id
    WHERE j.aluno_id IS NOT NULL AND a.id IS NULL
  `),
  query("orphan_professor_ids", `
    SELECT COUNT(*) AS total
    FROM j12_usuarios j LEFT JOIN j12_professores p ON p.id = j.professor_id
    WHERE j.professor_id IS NOT NULL AND p.id IS NULL
  `),
  query("orphan_responsavel_ids", `
    SELECT COUNT(*) AS total
    FROM j12_usuarios j LEFT JOIN j12_responsaveis r ON r.id = j.responsavel_id
    WHERE j.responsavel_id IS NOT NULL AND r.id IS NULL
  `),
  query("auth_identity_links", `
    SELECT
      SUM(CASE WHEN j.id IS NOT NULL THEN 1 ELSE 0 END) AS linked_total,
      SUM(CASE WHEN j.id IS NULL THEN 1 ELSE 0 END) AS orphan_total
    FROM auth_identities ai
    LEFT JOIN j12_usuarios j ON CAST(j.id AS CHAR) = ai.source_user_id
    WHERE ai.source = 'j12_usuarios'
  `),
  query("explicit_references", `
    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'j12_usuarios'
    ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION
  `),
  query("table_metadata", `
    SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('j12_usuarios','users','user_sessions','password_reset_tokens')
    ORDER BY TABLE_NAME
  `),
  query("legacy_indexes", `
    SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, SUB_PART, INDEX_TYPE
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'j12_usuarios'
    ORDER BY INDEX_NAME, SEQ_IN_INDEX
  `),
]);

async function runAuthLegacyPreflight({ queryRunner }) {
  if (typeof queryRunner !== "function")
    throw new TypeError("auth-legacy-preflight requires an injected read-only queryRunner.");
  const results = {};
  for (const item of AUTH_LEGACY_PREFLIGHT_QUERIES) {
    assertReadOnlySql(item.sql);
    results[item.id] = normalizeRows(await queryRunner(item.sql, [], { readOnly: true, id: item.id }));
  }
  return analyzeAuthLegacyPreflight(results);
}

function analyzeAuthLegacyPreflight(results = {}) {
  const blockers = [];
  addCountBlocker(blockers, results, "duplicate_emails", "LEGACY_DUPLICATE_EMAILS", true);
  addCountBlocker(blockers, results, "empty_emails", "LEGACY_EMPTY_EMAILS");
  addCountBlocker(blockers, results, "invalid_profiles", "LEGACY_INVALID_PROFILES", true);
  addCountBlocker(blockers, results, "null_status", "LEGACY_NULL_STATUS");
  addCountBlocker(blockers, results, "email_collisions", "AUTH_EMAIL_COLLISIONS", true);
  for (const [id, code] of [
    ["orphan_aluno_ids", "LEGACY_ORPHAN_ALUNO_IDS"],
    ["orphan_professor_ids", "LEGACY_ORPHAN_PROFESSOR_IDS"],
    ["orphan_responsavel_ids", "LEGACY_ORPHAN_RESPONSAVEL_IDS"],
  ])
    addCountBlocker(blockers, results, id, code);
  const identityOrphans = number(results.auth_identity_links?.[0]?.orphan_total);
  if (identityOrphans > 0)
    blockers.push({ code: "LEGACY_ORPHAN_AUTH_IDENTITIES", count: identityOrphans });

  const duplicateEmailCount = sumRows(results.duplicate_emails);
  return {
    command: "auth-legacy-preflight",
    readOnly: true,
    writesPerformed: false,
    safeForAutomaticModernization: false,
    automaticUniqueEmailAllowed: duplicateEmailCount === 0,
    summary: {
      records: number(results.legacy_summary?.[0]?.total),
      maxId: numberOrNull(results.legacy_summary?.[0]?.max_id),
      duplicateEmails: duplicateEmailCount,
      nullStatus: number(results.null_status?.[0]?.total),
      legacySessions: number(results.legacy_sessions?.[0]?.total),
      idOverlap: number(results.id_overlap?.[0]?.total),
      emailCollisions: sumRows(results.email_collisions),
    },
    blockers,
    results,
  };
}

function query(id, sql) {
  return Object.freeze({ id, sql: String(sql).trim(), readOnly: true });
}

function assertReadOnlySql(sql) {
  const normalized = String(sql || "").trim();
  if (!/^(SELECT|WITH)\b/iu.test(normalized) || /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|REPLACE)\b/iu.test(normalized)) {
    throw new Error("auth-legacy-preflight accepts SELECT-only statements.");
  }
}

function normalizeRows(value) {
  if (!Array.isArray(value)) return [];
  return Array.isArray(value[0]) ? value[0] : value;
}

function addCountBlocker(blockers, results, id, code, sum = false) {
  const count = sum ? sumRows(results[id]) : number(results[id]?.[0]?.total);
  if (count > 0) blockers.push({ code, count });
}

function sumRows(rows = []) {
  return rows.reduce((total, row) => total + number(row?.total), 0);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  return number(value);
}

module.exports = {
  AUTH_LEGACY_PREFLIGHT_QUERIES,
  analyzeAuthLegacyPreflight,
  assertReadOnlySql,
  runAuthLegacyPreflight,
};
