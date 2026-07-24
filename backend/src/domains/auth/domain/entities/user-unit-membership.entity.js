const { randomUUID } = require("node:crypto");

const {
  assertUserUnitMembershipRole,
  assertUserUnitMembershipStatus,
  normalizeUserUnitMembershipRole,
  normalizeUserUnitMembershipStatus,
} = require("../enums/index.js");

const USER_UNIT_MEMBERSHIP_ID_MAX_LENGTH = 64;
const USER_UNIT_MEMBERSHIP_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/u;
const USER_UNIT_MEMBERSHIP_UNIT_ID_PATTERN = /^[1-9][0-9]{0,19}$/u;

class UserUnitMembership {
  constructor(input = {}) {
    this.id = normalizeMembershipId(input.id) || randomUUID();
    this.authIdentityId = requiredText(
      input.authIdentityId ?? input.auth_identity_id,
      "authIdentityId",
      64,
    );
    this.unitId = normalizeUnitId(input.unitId ?? input.unit_id);
    this.role = assertUserUnitMembershipRole(input.role);
    this.status = normalizeUserUnitMembershipStatus(input.status) || "ACTIVE";
    this.isDefault = normalizeBooleanLike(input.isDefault ?? input.is_default, false);
    this.createdAt = nullableText(input.createdAt ?? input.created_at, 32);
    this.createdByAuthIdentityId = requiredText(
      input.createdByAuthIdentityId ?? input.created_by_auth_identity_id,
      "createdByAuthIdentityId",
      64,
    );
    this.updatedAt = nullableText(input.updatedAt ?? input.updated_at, 32);
    this.revokedAt = nullableText(input.revokedAt ?? input.revoked_at, 32);
    this.revokedByAuthIdentityId = nullableText(
      input.revokedByAuthIdentityId ?? input.revoked_by_auth_identity_id,
      64,
    );
    this.revocationReason = nullableText(
      input.revocationReason ?? input.revocation_reason,
      191,
    );

    if (this.isDefault && this.status !== "ACTIVE") {
      throw new TypeError("UserUnitMembership default membership must be ACTIVE.");
    }

    if (this.status === "REVOKED" && (!this.revokedAt || !this.revokedByAuthIdentityId)) {
      throw new TypeError("UserUnitMembership revoked state requires audit fields.");
    }
  }

  isActive() {
    return this.status === "ACTIVE";
  }

  canBeDefault() {
    return this.isActive();
  }

  revoke(input = {}) {
    const revokedAt = nullableText(input.revokedAt, 32) || this.revokedAt || nowSqlDateTime();
    const revokedByAuthIdentityId = requiredText(
      input.revokedByAuthIdentityId ?? input.revoked_by_auth_identity_id,
      "revokedByAuthIdentityId",
      64,
    );

    return new UserUnitMembership({
      ...this.toJSON(),
      isDefault: false,
      revokedAt,
      revokedByAuthIdentityId,
      status: "REVOKED",
      updatedAt: revokedAt,
    });
  }

  deactivate(input = {}) {
    const updatedAt = nullableText(input.updatedAt, 32) || nowSqlDateTime();

    return new UserUnitMembership({
      ...this.toJSON(),
      isDefault: false,
      status: "INACTIVE",
      updatedAt,
    });
  }

  changeRole(nextRole) {
    return new UserUnitMembership({
      ...this.toJSON(),
      role: assertUserUnitMembershipRole(nextRole),
    });
  }

  setDefault(isDefault = true) {
    const nextDefault = normalizeBooleanLike(isDefault, false);
    if (nextDefault && !this.isActive()) {
      throw new TypeError("UserUnitMembership default membership must be ACTIVE.");
    }

    return new UserUnitMembership({
      ...this.toJSON(),
      isDefault: nextDefault,
    });
  }

  toJSON() {
    return {
      authIdentityId: this.authIdentityId,
      createdAt: this.createdAt,
      createdByAuthIdentityId: this.createdByAuthIdentityId,
      id: this.id,
      isDefault: this.isDefault,
      role: this.role,
      revokedAt: this.revokedAt,
      revokedByAuthIdentityId: this.revokedByAuthIdentityId,
      status: this.status,
      unitId: this.unitId,
      updatedAt: this.updatedAt,
    };
  }
}

function normalizeMembershipId(value) {
  if (value == null || value === "") return null;
  const normalized = requiredText(value, "id", USER_UNIT_MEMBERSHIP_ID_MAX_LENGTH);
  if (!USER_UNIT_MEMBERSHIP_ID_PATTERN.test(normalized)) {
    throw new TypeError("UserUnitMembership id has an invalid format.");
  }
  return normalized;
}

function normalizeUnitId(value) {
  const normalized = requiredText(value, "unitId", 20);
  if (!USER_UNIT_MEMBERSHIP_UNIT_ID_PATTERN.test(normalized)) {
    throw new TypeError("UserUnitMembership unitId has an invalid format.");
  }
  return normalized;
}

function normalizeBooleanLike(value, fallback = false) {
  if (value === true || value === false) return value;
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new TypeError("UserUnitMembership boolean field is invalid.");
}

function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);
  if (!normalized) throw new TypeError(`UserUnitMembership requires ${field}.`);
  return normalized;
}

function nullableText(value, max = 65535) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length > max) {
    throw new TypeError("UserUnitMembership text field exceeds maximum length.");
  }
  return raw;
}

function nowSqlDateTime() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

module.exports = {
  USER_UNIT_MEMBERSHIP_ID_MAX_LENGTH,
  USER_UNIT_MEMBERSHIP_ID_PATTERN,
  USER_UNIT_MEMBERSHIP_UNIT_ID_PATTERN,
  UserUnitMembership,
  normalizeBooleanLike,
  normalizeMembershipId,
  normalizeUnitId,
};
