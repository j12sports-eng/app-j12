"use strict";

const {
  MIGRATION_ID,
  collectAuthRuntimePreflight,
} = require("../migrations/20260803133000_reconcile_auth_runtime_charset_collation");

async function attachOperationalPreflight(state, context, migrationId) {
  const migration = (state.doctorReport.migrations || []).find(
    (candidate) => candidate.id === migrationId,
  );
  if (migration?.applyPolicy?.operationalPreflight !== "AUTH_RUNTIME_TABLE_OPTIONS") return state;
  const preflight = await collectAuthRuntimePreflight({
    queryRunner: (sql, params) => context.reader.query(sql, params),
  });
  return {
    ...state,
    operationalPreflightByMigration: {
      ...(state.operationalPreflightByMigration || {}),
      [MIGRATION_ID]: preflight,
    },
  };
}

module.exports = { attachOperationalPreflight };
