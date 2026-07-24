const { randomUUID } = require("node:crypto");

const {
  EnrollmentDigitalInvitationStatus,
  normalizeEnrollmentDigitalInvitationStatus,
} = require("../enums/enrollment-digital-invitation-status.enum.js");

class EnrollmentDigitalInvitation {
  constructor(input = {}) {
    this.id = nullableText(input.id, 64) || randomUUID();
    this.enrollmentId = requiredText(input.enrollmentId ?? input.enrollment_id, "enrollmentId", 64);
    this.unitId = requiredText(input.unitId ?? input.unit_id, "unitId", 64);
    this.tokenHash = requiredText(input.tokenHash ?? input.token_hash, "tokenHash", 128);
    this.status =
      normalizeEnrollmentDigitalInvitationStatus(input.status) ||
      EnrollmentDigitalInvitationStatus.ACTIVE;
    this.expiresAt = requiredText(input.expiresAt ?? input.expires_at, "expiresAt", 32);
    this.createdAt = nullableText(input.createdAt ?? input.created_at, 32);
    this.createdBy = requiredText(input.createdBy ?? input.created_by, "createdBy", 191);
    this.revokedAt = nullableText(input.revokedAt ?? input.revoked_at, 32);
    this.revokedBy = nullableText(input.revokedBy ?? input.revoked_by, 191);
    this.usedAt = nullableText(input.usedAt ?? input.used_at, 32);
    this.usedBy = nullableText(input.usedBy ?? input.used_by, 191);
    this.replacedByInvitationId = nullableText(
      input.replacedByInvitationId ?? input.replaced_by_invitation_id,
      64,
    );
    this.metadata = normalizeMetadata(input.metadata ?? input.metadata_json);
  }

  isExpired(now = new Date()) {
    return parseDate(this.expiresAt).getTime() <= parseDate(now).getTime();
  }

  toJSON() {
    return {
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      enrollmentId: this.enrollmentId,
      expiresAt: this.expiresAt,
      id: this.id,
      metadata: this.metadata,
      replacedByInvitationId: this.replacedByInvitationId,
      revokedAt: this.revokedAt,
      revokedBy: this.revokedBy,
      status: this.status,
      tokenHash: this.tokenHash,
      unitId: this.unitId,
      usedAt: this.usedAt,
      usedBy: this.usedBy,
    };
  }
}

function parseDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function normalizeMetadata(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return normalizeMetadata(parsed);
    } catch {
      return {};
    }
  }
  if (typeof value !== "object" || Array.isArray(value)) return {};

  const blockedKeys = new Set(["cpf", "email", "telefone", "phone", "token", "tokenHash", "rawToken"]);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value).filter(([key]) => !blockedKeys.has(String(key).trim())),
    ),
  );
}

function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);
  if (!normalized) throw new TypeError(`EnrollmentDigitalInvitation requires ${field}.`);
  return normalized;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "").trim().slice(0, max);
  return normalized || null;
}

module.exports = {
  EnrollmentDigitalInvitation,
};
