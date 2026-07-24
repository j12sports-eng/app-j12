const { randomUUID } = require("node:crypto");

const {
  EnrollmentDigitalInvitationStatus,
  normalizeEnrollmentDigitalInvitationStatus,
} = require("../../domain/enums/enrollment-digital-invitation-status.enum.js");

class MemoryEnrollmentDigitalInvitationRepository {
  constructor({ initialRows = [] } = {}) {
    this.rows = new Map();
    for (const row of initialRows) {
      const normalized = normalizeRow(row);
      this.rows.set(normalized.id, normalized);
    }
  }

  async create(input = {}) {
    const row = normalizeRow(input);
    const active = await this.findActiveByEnrollment(row.enrollmentId);

    if (active) throw duplicateActiveInvitationError();

    this.rows.set(row.id, row);
    return clone(row);
  }

  async findById(id) {
    return clone(this.rows.get(String(id ?? "")) || null);
  }

  async findActiveByEnrollment(enrollmentId) {
    const id = String(enrollmentId ?? "");
    const active = [...this.rows.values()]
      .filter((row) => row.enrollmentId === id && row.status === EnrollmentDigitalInvitationStatus.ACTIVE)
      .sort(compareUpdatedDesc)[0];

    return clone(active || null);
  }

  async findByTokenHash(tokenHash) {
    const hash = String(tokenHash ?? "");
    const row = [...this.rows.values()].find((candidate) => candidate.tokenHash === hash);
    return clone(row || null);
  }

  async revokeInvitation(input = {}) {
    const invitationId = String(input.invitationId ?? "");
    const row = this.rows.get(invitationId);

    if (!row) return { changed: false, invitation: null };
    if (row.status === EnrollmentDigitalInvitationStatus.REVOKED) {
      return { changed: false, invitation: clone(row) };
    }

    row.status = EnrollmentDigitalInvitationStatus.REVOKED;
    row.revokedAt = nullableText(input.revokedAt, 32) || row.revokedAt;
    row.revokedBy = nullableText(input.revokedBy, 191) || row.revokedBy;
    row.replacedByInvitationId =
      nullableText(input.replacedByInvitationId, 64) || row.replacedByInvitationId;
    row.updatedAt = row.revokedAt || row.updatedAt;
    return { changed: true, invitation: clone(row) };
  }

  async expireInvitation(input = {}) {
    const invitationId = String(input.invitationId ?? "");
    const row = this.rows.get(invitationId);

    if (!row || row.status !== EnrollmentDigitalInvitationStatus.ACTIVE) {
      return { changed: false, invitation: clone(row || null) };
    }

    row.status = EnrollmentDigitalInvitationStatus.EXPIRED;
    row.updatedAt = nullableText(input.expiredAt, 32) || row.updatedAt;
    return { changed: true, invitation: clone(row) };
  }

  async replaceInvitation(input = {}) {
    const currentInvitationId = String(input.currentInvitationId ?? "");
    const previous = this.rows.get(currentInvitationId) || null;
    const replacement = normalizeRow(input.replacement || {});

    if (previous && previous.status === EnrollmentDigitalInvitationStatus.ACTIVE) {
      previous.status = EnrollmentDigitalInvitationStatus.REVOKED;
      previous.revokedAt = nullableText(input.revokedAt, 32) || previous.revokedAt;
      previous.revokedBy = nullableText(input.revokedBy, 191) || previous.revokedBy;
      previous.replacedByInvitationId = replacement.id;
      previous.updatedAt = previous.revokedAt || previous.updatedAt;
    }

    const active = await this.findActiveByEnrollment(replacement.enrollmentId);
    if (active) throw duplicateActiveInvitationError();

    this.rows.set(replacement.id, replacement);
    return {
      invitation: clone(replacement),
      previousInvitation: clone(previous),
      renewed: true,
    };
  }

  async markUsed(input = {}) {
    const invitationId = String(input.invitationId ?? "");
    const row = this.rows.get(invitationId);

    if (!row || row.status !== EnrollmentDigitalInvitationStatus.ACTIVE) {
      return { changed: false, invitation: clone(row || null) };
    }

    row.status = EnrollmentDigitalInvitationStatus.USED;
    row.usedAt = nullableText(input.usedAt, 32);
    row.usedBy = nullableText(input.usedBy, 191);
    row.updatedAt = row.usedAt || row.updatedAt;
    return { changed: true, invitation: clone(row) };
  }
}

function normalizeRow(input = {}) {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  return {
    createdAt: nullableText(input.createdAt ?? input.created_at, 32) || now,
    createdBy: requiredText(input.createdBy ?? input.created_by, "createdBy", 191),
    enrollmentId: requiredText(input.enrollmentId ?? input.enrollment_id, "enrollmentId", 64),
    expiresAt: requiredText(input.expiresAt ?? input.expires_at, "expiresAt", 32),
    id: nullableText(input.id, 64) || randomUUID(),
    metadata: normalizeMetadata(input.metadata ?? input.metadata_json),
    replacedByInvitationId: nullableText(
      input.replacedByInvitationId ?? input.replaced_by_invitation_id,
      64,
    ),
    revokedAt: nullableText(input.revokedAt ?? input.revoked_at, 32),
    revokedBy: nullableText(input.revokedBy ?? input.revoked_by, 191),
    status:
      normalizeEnrollmentDigitalInvitationStatus(input.status) ||
      EnrollmentDigitalInvitationStatus.ACTIVE,
    tokenHash: requiredText(input.tokenHash ?? input.token_hash, "tokenHash", 128),
    unitId: requiredText(input.unitId ?? input.unit_id, "unitId", 64),
    updatedAt: nullableText(input.updatedAt ?? input.updated_at, 32) || now,
    usedAt: nullableText(input.usedAt ?? input.used_at, 32),
    usedBy: nullableText(input.usedBy ?? input.used_by, 191),
  };
}

function duplicateActiveInvitationError() {
  const error = new Error("Duplicate active Enrollment digital invitation.");
  error.code = "ER_DUP_ENTRY";
  error.errno = 1062;
  error.sqlMessage = "Duplicate entry for key 'ux_edi_active_enrollment'";
  return error;
}

function compareUpdatedDesc(left, right) {
  return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
}

function normalizeMetadata(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return normalizeMetadata(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);
  if (!normalized) throw new TypeError(`MemoryEnrollmentDigitalInvitationRepository requires ${field}.`);
  return normalized;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "").trim().slice(0, max);
  return normalized || null;
}

module.exports = {
  MemoryEnrollmentDigitalInvitationRepository,
  duplicateActiveInvitationError,
};
