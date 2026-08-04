"use strict";

const AUTH_RUNTIME_HISTORICAL_MIGRATION =
  "20260712184500_create_auth_runtime_tables";

const AUTH_RUNTIME_ROLES = Object.freeze({
  AUTH_IDENTITIES: "CANONICAL_IDENTITY_BRIDGE",
  J12_USUARIOS: "LEGACY_READ_WRITE",
  PASSWORD_RESET_TOKENS: "CANONICAL_USERS_SUPPORT",
  USER_SESSIONS: "CANONICAL_USERS_SUPPORT",
  USERS: "PRIMARY_AUTH_USER",
});

const AUTH_RUNTIME_CLASSIFICATION = Object.freeze({
  migrationId: AUTH_RUNTIME_HISTORICAL_MIGRATION,
  legacyTable: "j12_usuarios",
  legacyRole: "LEGACY_AUTH_TABLE",
  legacyAccess: AUTH_RUNTIME_ROLES.J12_USUARIOS,
  compatibilityBoundary: "AUTH_SOURCE_ADAPTER",
  canonicalTables: Object.freeze([
    "users",
    "auth_identities",
    "user_unit_memberships",
  ]),
  supportTables: Object.freeze(["user_sessions", "password_reset_tokens"]),
  directCanonicalDependencyPolicy: "FORBIDDEN_OUTSIDE_AUTH_SOURCE_ADAPTER",
});

function classificationForMigration(migrationId) {
  return migrationId === AUTH_RUNTIME_HISTORICAL_MIGRATION
    ? AUTH_RUNTIME_CLASSIFICATION
    : null;
}

module.exports = {
  AUTH_RUNTIME_CLASSIFICATION,
  AUTH_RUNTIME_HISTORICAL_MIGRATION,
  AUTH_RUNTIME_ROLES,
  classificationForMigration,
};
