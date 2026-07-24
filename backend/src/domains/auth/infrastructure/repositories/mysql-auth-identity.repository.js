const { AuthIdentity, AuthIdentityStatus } = require("../../domain/index.js");

const TABLE_NAME = "auth_identities";
const AUTH_IDENTITY_SOURCE_USER_UNIQUE_INDEX = "ux_auth_identities_source_user";
const MYSQL_DUPLICATE_ENTRY_CODE = "ER_DUP_ENTRY";
const MYSQL_DUPLICATE_ENTRY_ERRNO = 1062;

const AUTH_IDENTITY_PROJECTION = `
  id,
  source,
  source_user_id,
  status,
  disabled_at,
  created_at,
  updated_at
`;

const INSERT_AUTH_IDENTITY_SQL = `
  INSERT INTO ${TABLE_NAME} (
    id,
    source,
    source_user_id,
    status,
    disabled_at
  )
  VALUES (?, ?, ?, ?, ?)
`;

const SELECT_AUTH_IDENTITY_BY_ID_SQL = `
  SELECT ${AUTH_IDENTITY_PROJECTION}
  FROM ${TABLE_NAME}
  WHERE id = ?
  LIMIT 1
`;

const SELECT_AUTH_IDENTITY_BY_SOURCE_USER_SQL = `
  SELECT ${AUTH_IDENTITY_PROJECTION}
  FROM ${TABLE_NAME}
  WHERE source = ?
    AND source_user_id = ?
  LIMIT 1
`;

const UPDATE_DISABLE_AUTH_IDENTITY_SQL = `
  UPDATE ${TABLE_NAME}
  SET status = ?,
      disabled_at = COALESCE(?, CURRENT_TIMESTAMP),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
    AND status = ?
  LIMIT 1
`;

class MySqlAuthIdentityRepository {
  constructor({ queryRunner = null } = {}) {
    this.query = queryRunner || getDefaultQueryRunner();
  }

  async create(input = {}, queryRunner = this.query) {
    const identity = new AuthIdentity(input).toJSON();

    try {
      const result = await queryRunner(INSERT_AUTH_IDENTITY_SQL, [
        identity.id,
        identity.source,
        identity.sourceUserId,
        identity.status,
        identity.disabledAt,
      ]);

      if (readAffectedRows(result) !== 1) {
        throw persistenceError("Unexpected AuthIdentity insert result.");
      }
    } catch (error) {
      if (isAuthIdentityDuplicateEntryError(error)) throw error;
      throw persistenceError("AuthIdentity persistence failed.");
    }

    return this.findById(identity.id, queryRunner);
  }

  async findById(id, queryRunner = this.query) {
    const probe = new AuthIdentity({
      id,
      source: "users",
      sourceUserId: "identity-probe",
    });
    const rows = await queryRunner(SELECT_AUTH_IDENTITY_BY_ID_SQL, [probe.id]);
    return toAuthIdentityData(readFirstRow(rows));
  }

  async findBySourceUser(input = {}, queryRunner = this.query) {
    const probe = new AuthIdentity({
      id: "auth-identity-probe",
      source: input.source,
      sourceUserId: input.sourceUserId,
    });
    const rows = await queryRunner(SELECT_AUTH_IDENTITY_BY_SOURCE_USER_SQL, [
      probe.source,
      probe.sourceUserId,
    ]);
    return toAuthIdentityData(readFirstRow(rows));
  }

  async disableIdentity(input = {}, queryRunner = this.query) {
    const probe = new AuthIdentity({
      id: input.identityId ?? input.id,
      source: "users",
      sourceUserId: "identity-probe",
    });
    const result = await queryRunner(UPDATE_DISABLE_AUTH_IDENTITY_SQL, [
      AuthIdentityStatus.DISABLED,
      nullableText(input.disabledAt ?? input.disabled_at, 32),
      probe.id,
      AuthIdentityStatus.ACTIVE,
    ]);

    return {
      changed: readAffectedRows(result) === 1,
      identity: await this.findById(probe.id, queryRunner),
    };
  }
}

function toAuthIdentityData(row) {
  if (!row || typeof row !== "object") return null;
  return {
    createdAt: row.created_at ?? null,
    disabledAt: row.disabled_at ?? null,
    id: row.id ?? null,
    source: row.source ?? null,
    sourceUserId: row.source_user_id ?? null,
    status: row.status ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function isAuthIdentityDuplicateEntryError(error) {
  if (!error || typeof error !== "object") return false;
  const duplicateCode = String(error.code ?? "") === MYSQL_DUPLICATE_ENTRY_CODE;
  const duplicateErrno = Number(error.errno ?? error.code) === MYSQL_DUPLICATE_ENTRY_ERRNO;
  if (!duplicateCode && !duplicateErrno) return false;
  const message = [error.message, error.sqlMessage, error.sql].filter(Boolean).join(" ");
  return message.includes(AUTH_IDENTITY_SOURCE_USER_UNIQUE_INDEX) || !message;
}

function persistenceError(message) {
  const error = new Error(message);
  error.code = "AUTH_IDENTITY_PERSISTENCE_FAILED";
  return error;
}

function readAffectedRows(result) {
  if (Array.isArray(result)) {
    const header = result.find(
      (item) => item && typeof item === "object" && "affectedRows" in item,
    );
    return normalizeAffectedRows(header?.affectedRows);
  }
  return normalizeAffectedRows(result?.affectedRows);
}

function normalizeAffectedRows(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function readFirstRow(result) {
  if (!Array.isArray(result) || result.length === 0) return null;
  const rows = Array.isArray(result[0]) ? result[0] : result;
  const row = rows[0];
  return row && typeof row === "object" && !Array.isArray(row) ? row : null;
}

function nullableText(value, max = 65535) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return raw.length > max ? raw.slice(0, max) : raw;
}

function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

module.exports = {
  AUTH_IDENTITY_PROJECTION,
  AUTH_IDENTITY_SOURCE_USER_UNIQUE_INDEX,
  INSERT_AUTH_IDENTITY_SQL,
  MySqlAuthIdentityRepository,
  SELECT_AUTH_IDENTITY_BY_ID_SQL,
  SELECT_AUTH_IDENTITY_BY_SOURCE_USER_SQL,
  TABLE_NAME,
  UPDATE_DISABLE_AUTH_IDENTITY_SQL,
  isAuthIdentityDuplicateEntryError,
  readAffectedRows,
  readFirstRow,
  toAuthIdentityData,
};
