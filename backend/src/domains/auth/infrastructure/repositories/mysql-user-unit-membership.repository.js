const { UserUnitMembership, UserUnitMembershipStatus } = require("../../domain/index.js");

const TABLE_NAME = "user_unit_memberships";
const UNIQUE_IDENTITY_UNIT_INDEX = "ux_user_unit_memberships_identity_unit";
const UNIQUE_ACTIVE_DEFAULT_INDEX = "ux_user_unit_memberships_active_default";
const MYSQL_DUPLICATE_ENTRY_CODE = "ER_DUP_ENTRY";
const MYSQL_DUPLICATE_ENTRY_ERRNO = 1062;

const MEMBERSHIP_PROJECTION = `
  id,
  auth_identity_id,
  unit_id,
  role,
  status,
  is_default,
  active_default_key,
  created_at,
  created_by_auth_identity_id,
  updated_at,
  revoked_at,
  revoked_by_auth_identity_id
`;

const INSERT_MEMBERSHIP_SQL = `
  INSERT INTO ${TABLE_NAME} (
    id,
    auth_identity_id,
    unit_id,
    role,
    status,
    is_default,
    created_by_auth_identity_id,
    revoked_at,
    revoked_by_auth_identity_id
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SELECT_MEMBERSHIP_BY_ID_SQL = `
  SELECT ${MEMBERSHIP_PROJECTION}
  FROM ${TABLE_NAME}
  WHERE id = ?
  LIMIT 1
`;

const SELECT_MEMBERSHIP_BY_IDENTITY_AND_UNIT_SQL = `
  SELECT ${MEMBERSHIP_PROJECTION}
  FROM ${TABLE_NAME}
  WHERE auth_identity_id = ?
    AND unit_id = ?
  LIMIT 1
`;

const SELECT_MEMBERSHIPS_BY_IDENTITY_SQL = `
  SELECT ${MEMBERSHIP_PROJECTION}
  FROM ${TABLE_NAME}
  WHERE auth_identity_id = ?
  ORDER BY is_default DESC, created_at ASC, id ASC
`;

const SELECT_ACTIVE_MEMBERSHIPS_BY_IDENTITY_SQL = `
  SELECT ${MEMBERSHIP_PROJECTION}
  FROM ${TABLE_NAME}
  WHERE auth_identity_id = ?
    AND status = ?
  ORDER BY is_default DESC, created_at ASC, id ASC
`;

const SELECT_ACTIVE_DEFAULT_BY_IDENTITY_SQL = `
  SELECT ${MEMBERSHIP_PROJECTION}
  FROM ${TABLE_NAME}
  WHERE auth_identity_id = ?
    AND status = ?
    AND is_default = 1
  LIMIT 1
`;

const SELECT_ACTIVE_MEMBERSHIP_FOR_CHECK_SQL = `
  SELECT
    m.*,
    ai.status AS auth_identity_status,
    u.status AS unit_status
  FROM ${TABLE_NAME} m
  INNER JOIN auth_identities ai ON ai.id = m.auth_identity_id
  INNER JOIN j12_unidades u ON u.id = m.unit_id
  WHERE m.auth_identity_id = ?
    AND m.unit_id = ?
    AND m.status = ?
    AND ai.status = ?
    AND u.status = ?
  LIMIT 1
`;

const UPDATE_REVOKE_MEMBERSHIP_SQL = `
  UPDATE ${TABLE_NAME}
  SET status = ?,
      is_default = 0,
      revoked_at = COALESCE(?, CURRENT_TIMESTAMP),
      revoked_by_auth_identity_id = ?,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
    AND status <> ?
  LIMIT 1
`;

const UPDATE_DEACTIVATE_MEMBERSHIP_SQL = `
  UPDATE ${TABLE_NAME}
  SET status = ?,
      is_default = 0,
      updated_at = COALESCE(?, CURRENT_TIMESTAMP)
  WHERE id = ?
    AND status = ?
  LIMIT 1
`;

const UPDATE_CHANGE_ROLE_MEMBERSHIP_SQL = `
  UPDATE ${TABLE_NAME}
  SET role = ?,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
    AND status <> ?
  LIMIT 1
`;

const UPDATE_SET_DEFAULT_MEMBERSHIP_SQL = `
  UPDATE ${TABLE_NAME}
  SET is_default = 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
    AND status = ?
  LIMIT 1
`;

const CLEAR_DEFAULT_BY_IDENTITY_SQL = `
  UPDATE ${TABLE_NAME}
  SET is_default = 0,
      updated_at = CURRENT_TIMESTAMP
  WHERE auth_identity_id = ?
    AND status = ?
    AND is_default = 1
`;

class MySqlUserUnitMembershipRepository {
  constructor({ queryRunner = null, transactionRunner = null } = {}) {
    this.query = queryRunner || getDefaultQueryRunner();
    this.transactionRunner = typeof transactionRunner === "function" ? transactionRunner : null;
  }

  async create(input = {}, queryRunner = this.query) {
    const membership = normalizeMembership(input);
    await queryRunner(INSERT_MEMBERSHIP_SQL, [
      membership.id,
      membership.authIdentityId,
      membership.unitId,
      membership.role,
      membership.status,
      membership.isDefault ? 1 : 0,
      membership.createdByAuthIdentityId,
      membership.revokedAt,
      membership.revokedByAuthIdentityId,
    ]);

    return this.findById(membership.id, queryRunner);
  }

  async findById(id, queryRunner = this.query) {
    const membershipId = requiredText(id, "membershipId", 64);
    const rows = await queryRunner(SELECT_MEMBERSHIP_BY_ID_SQL, [membershipId]);
    return toUserUnitMembershipData(readFirstRow(rows));
  }

  async findByIdentityAndUnit(input = {}, queryRunner = this.query) {
    const authIdentityId = requiredText(input.authIdentityId, "authIdentityId", 64);
    const unitId = requiredUnitId(input.unitId);
    const rows = await queryRunner(SELECT_MEMBERSHIP_BY_IDENTITY_AND_UNIT_SQL, [
      authIdentityId,
      unitId,
    ]);
    return toUserUnitMembershipData(readFirstRow(rows));
  }

  async listByIdentity(authIdentityId, queryRunner = this.query) {
    const identityId = requiredText(authIdentityId, "authIdentityId", 64);
    const rows = await queryRunner(SELECT_MEMBERSHIPS_BY_IDENTITY_SQL, [identityId]);
    return readRows(rows).map(toUserUnitMembershipData).filter(Boolean);
  }

  async listActiveByIdentity(authIdentityId, queryRunner = this.query) {
    const identityId = requiredText(authIdentityId, "authIdentityId", 64);
    const rows = await queryRunner(SELECT_ACTIVE_MEMBERSHIPS_BY_IDENTITY_SQL, [
      identityId,
      UserUnitMembershipStatus.ACTIVE,
    ]);
    return readRows(rows).map(toUserUnitMembershipData).filter(Boolean);
  }

  async revoke(input = {}, queryRunner = this.query) {
    const membershipId = requiredText(input.membershipId, "membershipId", 64);
    const result = await queryRunner(UPDATE_REVOKE_MEMBERSHIP_SQL, [
      UserUnitMembershipStatus.REVOKED,
      nullableText(input.revokedAt, 32),
      requiredText(input.revokedByAuthIdentityId, "revokedByAuthIdentityId", 64),
      membershipId,
      UserUnitMembershipStatus.REVOKED,
    ]);
    return {
      changed: readAffectedRows(result) > 0,
      membership: await this.findById(membershipId, queryRunner),
    };
  }

  async deactivate(input = {}, queryRunner = this.query) {
    const membershipId = requiredText(input.membershipId, "membershipId", 64);
    const result = await queryRunner(UPDATE_DEACTIVATE_MEMBERSHIP_SQL, [
      UserUnitMembershipStatus.INACTIVE,
      nullableText(input.deactivatedAt, 32),
      membershipId,
      UserUnitMembershipStatus.ACTIVE,
    ]);
    return {
      changed: readAffectedRows(result) > 0,
      membership: await this.findById(membershipId, queryRunner),
    };
  }

  async changeRole(input = {}, queryRunner = this.query) {
    const membershipId = requiredText(input.membershipId, "membershipId", 64);
    const nextRole = normalizeRole(input.role);
    const current = await this.findById(membershipId, queryRunner);

    if (!current) {
      return { changed: false, membership: null, previousRole: null };
    }

    if (current.status === UserUnitMembershipStatus.REVOKED) {
      return { changed: false, membership: current, previousRole: current.role };
    }

    if (current.role === nextRole) {
      return { changed: false, membership: current, previousRole: current.role };
    }

    const result = await queryRunner(UPDATE_CHANGE_ROLE_MEMBERSHIP_SQL, [
      nextRole,
      membershipId,
      UserUnitMembershipStatus.REVOKED,
    ]);

    return {
      changed: readAffectedRows(result) > 0,
      membership: await this.findById(membershipId, queryRunner),
      previousRole: current.role,
    };
  }

  async setDefault(input = {}, queryRunner = this.query) {
    const membershipId = requiredText(input.membershipId, "membershipId", 64);
    const membership = await this.findById(membershipId, queryRunner);
    if (!membership) return { changed: false, membership: null };
    if (membership.status !== UserUnitMembershipStatus.ACTIVE) {
      return { changed: false, membership };
    }
    if (membership.isDefault) {
      return { changed: false, membership };
    }

    const clearResult = await queryRunner(CLEAR_DEFAULT_BY_IDENTITY_SQL, [
      membership.authIdentityId,
      UserUnitMembershipStatus.ACTIVE,
    ]);
    const setResult = await queryRunner(UPDATE_SET_DEFAULT_MEMBERSHIP_SQL, [
      membershipId,
      UserUnitMembershipStatus.ACTIVE,
    ]);

    return {
      changed: readAffectedRows(clearResult) > 0 || readAffectedRows(setResult) > 0,
      membership: await this.findById(membershipId, queryRunner),
    };
  }

  async clearDefaultByIdentity(authIdentityId, queryRunner = this.query) {
    const identityId = requiredText(authIdentityId, "authIdentityId", 64);
    const result = await queryRunner(CLEAR_DEFAULT_BY_IDENTITY_SQL, [
      identityId,
      UserUnitMembershipStatus.ACTIVE,
    ]);
    return {
      changed: readAffectedRows(result) > 0,
      count: readAffectedRows(result),
    };
  }

  async setDefaultTransactionally(input = {}) {
    const work = async (queryRunner = this.query) => {
      const membershipId = requiredText(input.membershipId, "membershipId", 64);
      const membership = await this.findById(membershipId, queryRunner);
      if (!membership) {
        return { changed: false, membership: null, previousDefault: null, reused: false };
      }
      if (membership.status !== UserUnitMembershipStatus.ACTIVE) {
        return { changed: false, membership, previousDefault: null, reused: false };
      }
      if (membership.isDefault) {
        return {
          changed: false,
          membership,
          previousDefault: membership,
          reused: true,
        };
      }

      const previousDefault = await this.findActiveDefaultByIdentity(
        membership.authIdentityId,
        queryRunner,
      );
      if (previousDefault && previousDefault.id !== membership.id) {
        await queryRunner(CLEAR_DEFAULT_BY_IDENTITY_SQL, [
          membership.authIdentityId,
          UserUnitMembershipStatus.ACTIVE,
        ]);
      }

      const setResult = await queryRunner(UPDATE_SET_DEFAULT_MEMBERSHIP_SQL, [
        membership.id,
        UserUnitMembershipStatus.ACTIVE,
      ]);

      if (readAffectedRows(setResult) !== 1) {
        throw persistenceError("Unable to set default membership.");
      }

      return {
        changed: true,
        membership: await this.findById(membership.id, queryRunner),
        previousDefault,
        reused: false,
      };
    };

    return this.transactionRunner ? this.transactionRunner(work) : work(this.query);
  }

  async checkActive(input = {}, queryRunner = this.query) {
    const authIdentityId = requiredText(input.authIdentityId, "authIdentityId", 64);
    const unitId = requiredUnitId(input.unitId);
    const rows = await queryRunner(SELECT_ACTIVE_MEMBERSHIP_FOR_CHECK_SQL, [
      authIdentityId,
      unitId,
      UserUnitMembershipStatus.ACTIVE,
      "ACTIVE",
      "ativo",
    ]);
    return toUserUnitMembershipData(readFirstRow(rows));
  }

  async findActiveDefaultByIdentity(authIdentityId, queryRunner = this.query) {
    const identityId = requiredText(authIdentityId, "authIdentityId", 64);
    const rows = await queryRunner(SELECT_ACTIVE_DEFAULT_BY_IDENTITY_SQL, [
      identityId,
      UserUnitMembershipStatus.ACTIVE,
    ]);
    return toUserUnitMembershipData(readFirstRow(rows));
  }
}

function normalizeMembership(input = {}) {
  const membership = input instanceof UserUnitMembership ? input : new UserUnitMembership(input);
  return membership;
}

function toUserUnitMembershipData(row) {
  if (!row || typeof row !== "object") return null;
  return {
    authIdentityId: row.auth_identity_id ?? null,
    createdAt: row.created_at ?? null,
    createdByAuthIdentityId: row.created_by_auth_identity_id ?? null,
    id: row.id ?? null,
    isDefault: normalizeBoolean(row.is_default),
    role: row.role ?? null,
    revokedAt: row.revoked_at ?? null,
    revokedByAuthIdentityId: row.revoked_by_auth_identity_id ?? null,
    status: row.status ?? null,
    unitId: row.unit_id == null ? null : String(row.unit_id),
    updatedAt: row.updated_at ?? null,
  };
}

function normalizeRole(value) {
  return new UserUnitMembership({
    authIdentityId: "auth-identity-probe",
    createdByAuthIdentityId: "auth-identity-probe",
    role: value,
    unitId: "1",
  }).role;
}

function normalizeBoolean(value) {
  return value === true || value === 1 || String(value ?? "").trim() === "1";
}

function isUserUnitMembershipDuplicateEntryError(error) {
  if (!error || typeof error !== "object") return false;
  const duplicateCode = String(error.code ?? "") === MYSQL_DUPLICATE_ENTRY_CODE;
  const duplicateErrno = Number(error.errno ?? error.code) === MYSQL_DUPLICATE_ENTRY_ERRNO;
  if (!duplicateCode && !duplicateErrno) return false;
  const message = [error.message, error.sqlMessage, error.sql].filter(Boolean).join(" ");
  return message.includes(UNIQUE_IDENTITY_UNIT_INDEX) || message.includes(UNIQUE_ACTIVE_DEFAULT_INDEX);
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

function readRows(result) {
  if (!Array.isArray(result) || result.length === 0) return [];
  return Array.isArray(result[0]) ? result[0] : result;
}

function persistenceError(message) {
  const error = new Error(message);
  error.code = "USER_UNIT_MEMBERSHIP_PERSISTENCE_ERROR";
  return error;
}

function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);
  if (!normalized) {
    throw new TypeError(`MySqlUserUnitMembershipRepository requires ${field}.`);
  }
  return normalized;
}

function requiredUnitId(value) {
  const normalized = String(value ?? "").trim();
  if (!/^[1-9][0-9]{0,19}$/.test(normalized)) {
    throw new TypeError("MySqlUserUnitMembershipRepository requires unitId.");
  }
  return normalized;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized.length > max ? normalized.slice(0, max) : normalized;
}

module.exports = {
  CLEAR_DEFAULT_BY_IDENTITY_SQL,
  INSERT_MEMBERSHIP_SQL,
  MEMBERSHIP_PROJECTION,
  MySqlUserUnitMembershipRepository,
  SELECT_ACTIVE_DEFAULT_BY_IDENTITY_SQL,
  SELECT_ACTIVE_MEMBERSHIP_FOR_CHECK_SQL,
  SELECT_ACTIVE_MEMBERSHIPS_BY_IDENTITY_SQL,
  SELECT_MEMBERSHIP_BY_IDENTITY_AND_UNIT_SQL,
  SELECT_MEMBERSHIP_BY_ID_SQL,
  SELECT_MEMBERSHIPS_BY_IDENTITY_SQL,
  TABLE_NAME,
  UPDATE_CHANGE_ROLE_MEMBERSHIP_SQL,
  UPDATE_DEACTIVATE_MEMBERSHIP_SQL,
  UPDATE_REVOKE_MEMBERSHIP_SQL,
  UPDATE_SET_DEFAULT_MEMBERSHIP_SQL,
  isUserUnitMembershipDuplicateEntryError,
  normalizeRole,
  readAffectedRows,
  readFirstRow,
  readRows,
  toUserUnitMembershipData,
};
