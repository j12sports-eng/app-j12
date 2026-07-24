const { randomUUID } = require("node:crypto");

const {
  EnrollmentDigitalInvitationStatus,
  normalizeEnrollmentDigitalInvitationStatus,
} = require("../../domain/enums/enrollment-digital-invitation-status.enum.js");

const TABLE_NAME = "enrollment_digital_invitations";
const ACTIVE_INVITATION_UNIQUE_INDEX = "ux_edi_active_enrollment";
const MYSQL_DUPLICATE_ENTRY_CODE = "ER_DUP_ENTRY";
const MYSQL_DUPLICATE_ENTRY_ERRNO = 1062;

const INVITATION_PROJECTION = `
  id,
  enrollment_id,
  unit_id,
  token_hash,
  status,
  expires_at,
  created_at,
  created_by,
  revoked_at,
  revoked_by,
  used_at,
  used_by,
  replaced_by_invitation_id,
  metadata_json,
  updated_at
`;

const INSERT_INVITATION_SQL = `
  INSERT INTO ${TABLE_NAME} (
    id,
    enrollment_id,
    unit_id,
    token_hash,
    status,
    expires_at,
    created_by,
    metadata_json
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

const SELECT_INVITATION_BY_ID_SQL = `
  SELECT ${INVITATION_PROJECTION}
  FROM ${TABLE_NAME}
  WHERE id = ?
  LIMIT 1
`;

const SELECT_ACTIVE_INVITATION_BY_ENROLLMENT_SQL = `
  SELECT ${INVITATION_PROJECTION}
  FROM ${TABLE_NAME}
  WHERE enrollment_id = ?
    AND status = ?
  ORDER BY created_at DESC, id DESC
  LIMIT 1
`;

const SELECT_INVITATION_BY_TOKEN_HASH_SQL = `
  SELECT ${INVITATION_PROJECTION}
  FROM ${TABLE_NAME}
  WHERE token_hash = ?
  LIMIT 1
`;

const UPDATE_REVOKE_INVITATION_SQL = `
  UPDATE ${TABLE_NAME}
  SET status = ?,
      revoked_at = COALESCE(?, CURRENT_TIMESTAMP),
      revoked_by = ?,
      replaced_by_invitation_id = COALESCE(?, replaced_by_invitation_id),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
    AND status = ?
  LIMIT 1
`;

const UPDATE_EXPIRE_INVITATION_SQL = `
  UPDATE ${TABLE_NAME}
  SET status = ?,
      updated_at = COALESCE(?, CURRENT_TIMESTAMP)
  WHERE id = ?
    AND status = ?
  LIMIT 1
`;

const UPDATE_MARK_USED_SQL = `
  UPDATE ${TABLE_NAME}
  SET status = ?,
      used_at = COALESCE(?, CURRENT_TIMESTAMP),
      used_by = ?,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
    AND status = ?
  LIMIT 1
`;

class MySqlEnrollmentDigitalInvitationRepository {
  constructor({ queryRunner = null, transactionRunner = null } = {}) {
    this.query = queryRunner || getDefaultQueryRunner();
    this.transactionRunner = typeof transactionRunner === "function" ? transactionRunner : null;
  }

  async create(input = {}, queryRunner = this.query) {
    const values = normalizeCreateInput(input);

    await queryRunner(INSERT_INVITATION_SQL, [
      values.id,
      values.enrollmentId,
      values.unitId,
      values.tokenHash,
      EnrollmentDigitalInvitationStatus.ACTIVE,
      values.expiresAt,
      values.createdBy,
      values.metadataJson,
    ]);

    return this.findById(values.id, queryRunner);
  }

  async findById(id, queryRunner = this.query) {
    const invitationId = requiredText(id, "id", 64);
    const rows = await queryRunner(SELECT_INVITATION_BY_ID_SQL, [invitationId]);
    return toInvitationData(readFirstRow(rows));
  }

  async findActiveByEnrollment(enrollmentId, queryRunner = this.query) {
    const id = requiredText(enrollmentId, "enrollmentId", 64);
    const rows = await queryRunner(SELECT_ACTIVE_INVITATION_BY_ENROLLMENT_SQL, [
      id,
      EnrollmentDigitalInvitationStatus.ACTIVE,
    ]);
    return toInvitationData(readFirstRow(rows));
  }

  async findByTokenHash(tokenHash, queryRunner = this.query) {
    const hash = requiredTokenHash(tokenHash);
    const rows = await queryRunner(SELECT_INVITATION_BY_TOKEN_HASH_SQL, [hash]);
    return toInvitationData(readFirstRow(rows));
  }

  async revokeInvitation(input = {}, queryRunner = this.query) {
    const invitationId = requiredText(input.invitationId, "invitationId", 64);
    const result = await queryRunner(UPDATE_REVOKE_INVITATION_SQL, [
      EnrollmentDigitalInvitationStatus.REVOKED,
      nullableText(input.revokedAt, 32),
      nullableText(input.revokedBy, 191),
      nullableText(input.replacedByInvitationId, 64),
      invitationId,
      EnrollmentDigitalInvitationStatus.ACTIVE,
    ]);
    return {
      changed: readAffectedRows(result) > 0,
      invitation: await this.findById(invitationId, queryRunner),
    };
  }

  async expireInvitation(input = {}, queryRunner = this.query) {
    const invitationId = requiredText(input.invitationId, "invitationId", 64);
    const result = await queryRunner(UPDATE_EXPIRE_INVITATION_SQL, [
      EnrollmentDigitalInvitationStatus.EXPIRED,
      nullableText(input.expiredAt, 32),
      invitationId,
      EnrollmentDigitalInvitationStatus.ACTIVE,
    ]);
    return {
      changed: readAffectedRows(result) > 0,
      invitation: await this.findById(invitationId, queryRunner),
    };
  }

  async replaceInvitation(input = {}) {
    const work = async (queryRunner = this.query) => {
      const replacement = normalizeCreateInput(input.replacement || {});
      const previous = await this.findById(input.currentInvitationId, queryRunner);

      if (previous && previous.status === EnrollmentDigitalInvitationStatus.ACTIVE) {
        await this.revokeInvitation(
          {
            invitationId: previous.id,
            replacedByInvitationId: replacement.id,
            revokedAt: input.revokedAt,
            revokedBy: input.revokedBy,
          },
          queryRunner,
        );
      }

      return {
        invitation: await this.create(replacement, queryRunner),
        previousInvitation: previous,
        renewed: true,
      };
    };

    return this.transactionRunner ? this.transactionRunner(work) : work(this.query);
  }

  async markUsed(input = {}) {
    const invitationId = requiredText(input.invitationId, "invitationId", 64);
    const result = await this.query(UPDATE_MARK_USED_SQL, [
      EnrollmentDigitalInvitationStatus.USED,
      nullableText(input.usedAt, 32),
      nullableText(input.usedBy, 191),
      invitationId,
      EnrollmentDigitalInvitationStatus.ACTIVE,
    ]);
    return {
      changed: readAffectedRows(result) > 0,
      invitation: await this.findById(invitationId),
    };
  }
}

function normalizeCreateInput(input = {}) {
  const metadata =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? input.metadata
      : null;

  return {
    createdBy: requiredText(input.createdBy ?? input.created_by, "createdBy", 191),
    enrollmentId: requiredText(input.enrollmentId ?? input.enrollment_id, "enrollmentId", 64),
    expiresAt: requiredText(input.expiresAt ?? input.expires_at, "expiresAt", 32),
    id: nullableText(input.id, 64) || randomUUID(),
    metadataJson: metadata ? JSON.stringify(metadata) : null,
    tokenHash: requiredTokenHash(input.tokenHash ?? input.token_hash),
    unitId: requiredText(input.unitId ?? input.unit_id, "unitId", 64),
  };
}

function toInvitationData(row) {
  if (!row || typeof row !== "object") return null;
  return {
    createdAt: row.created_at ?? null,
    createdBy: row.created_by ?? null,
    enrollmentId: row.enrollment_id ?? null,
    expiresAt: row.expires_at ?? null,
    id: row.id ?? null,
    metadata: parseMetadata(row.metadata_json),
    replacedByInvitationId: row.replaced_by_invitation_id ?? null,
    revokedAt: row.revoked_at ?? null,
    revokedBy: row.revoked_by ?? null,
    status: normalizeEnrollmentDigitalInvitationStatus(row.status) || row.status,
    tokenHash: row.token_hash ?? null,
    unitId: row.unit_id ?? null,
    updatedAt: row.updated_at ?? null,
    usedAt: row.used_at ?? null,
    usedBy: row.used_by ?? null,
  };
}

function isActiveInvitationDuplicateEntryError(error) {
  if (!error || typeof error !== "object") return false;
  const duplicateCode = String(error.code ?? "") === MYSQL_DUPLICATE_ENTRY_CODE;
  const duplicateErrno = Number(error.errno ?? error.code) === MYSQL_DUPLICATE_ENTRY_ERRNO;
  if (!duplicateCode && !duplicateErrno) return false;
  const message = [error.message, error.sqlMessage, error.sql].filter(Boolean).join(" ");
  return message.includes(ACTIVE_INVITATION_UNIQUE_INDEX);
}

function requiredTokenHash(value) {
  const hash = requiredText(value, "tokenHash", 128);
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new TypeError("MySqlEnrollmentDigitalInvitationRepository requires a SHA-256 tokenHash.");
  }
  return hash;
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

function parseMetadata(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);
  if (!normalized) {
    throw new TypeError(`MySqlEnrollmentDigitalInvitationRepository requires ${field}.`);
  }
  return normalized;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "").trim().slice(0, max);
  return normalized || null;
}

module.exports = {
  ACTIVE_INVITATION_UNIQUE_INDEX,
  INSERT_INVITATION_SQL,
  INVITATION_PROJECTION,
  MySqlEnrollmentDigitalInvitationRepository,
  SELECT_ACTIVE_INVITATION_BY_ENROLLMENT_SQL,
  SELECT_INVITATION_BY_ID_SQL,
  SELECT_INVITATION_BY_TOKEN_HASH_SQL,
  TABLE_NAME,
  UPDATE_EXPIRE_INVITATION_SQL,
  UPDATE_MARK_USED_SQL,
  UPDATE_REVOKE_INVITATION_SQL,
  isActiveInvitationDuplicateEntryError,
  readAffectedRows,
  readFirstRow,
  toInvitationData,
};
