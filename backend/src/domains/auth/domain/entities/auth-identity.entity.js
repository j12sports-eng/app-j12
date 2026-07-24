const { randomUUID } = require("node:crypto");

const {
  AuthIdentitySource,
  assertAuthIdentitySource,
} = require("../enums/auth-identity-source.enum.js");
const {
  AuthIdentityStatus,
  assertAuthIdentityStatus,
  normalizeAuthIdentityStatus,
} = require("../enums/auth-identity-status.enum.js");

const AUTH_IDENTITY_ID_MAX_LENGTH = 64;
const AUTH_IDENTITY_SOURCE_USER_ID_MAX_LENGTH = 64;
const AUTH_IDENTITY_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/u;
const AUTH_IDENTITY_USERS_SOURCE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/u;
const AUTH_IDENTITY_J12_SOURCE_ID_PATTERN = /^[1-9][0-9]{0,19}$/u;

class AuthIdentity {
  constructor(input = {}) {
    this.id = normalizeAuthIdentityId(input.id) || randomUUID();
    this.source = assertAuthIdentitySource(input.source);
    this.sourceUserId = normalizeAuthIdentitySourceUserId(
      input.sourceUserId ?? input.source_user_id,
      this.source,
    );
    this.status =
      normalizeAuthIdentityStatus(input.status) || AuthIdentityStatus.ACTIVE;
    this.disabledAt = nullableText(input.disabledAt ?? input.disabled_at, 32);
    this.createdAt = nullableText(input.createdAt ?? input.created_at, 32);
    this.updatedAt = nullableText(input.updatedAt ?? input.updated_at, 32);
  }

  isActive() {
    return this.status === AuthIdentityStatus.ACTIVE;
  }

  toJSON() {
    return {
      createdAt: this.createdAt,
      disabledAt: this.disabledAt,
      id: this.id,
      source: this.source,
      sourceUserId: this.sourceUserId,
      status: this.status,
      updatedAt: this.updatedAt,
    };
  }
}

function normalizeAuthIdentityId(value) {
  if (value == null || value === "") return null;
  const normalized = requiredText(value, "id", AUTH_IDENTITY_ID_MAX_LENGTH);
  if (!AUTH_IDENTITY_ID_PATTERN.test(normalized)) {
    throw new TypeError("AuthIdentity id has an invalid format.");
  }
  return normalized;
}

function normalizeAuthIdentitySourceUserId(value, sourceValue) {
  const source = assertAuthIdentitySource(sourceValue);
  const normalized = requiredText(
    value,
    "sourceUserId",
    AUTH_IDENTITY_SOURCE_USER_ID_MAX_LENGTH,
  );

  if (source === AuthIdentitySource.J12_USUARIOS) {
    if (!AUTH_IDENTITY_J12_SOURCE_ID_PATTERN.test(normalized)) {
      throw new TypeError("AuthIdentity sourceUserId has an invalid format.");
    }
    return normalized;
  }

  if (!AUTH_IDENTITY_USERS_SOURCE_ID_PATTERN.test(normalized)) {
    throw new TypeError("AuthIdentity sourceUserId has an invalid format.");
  }
  return normalized;
}

function requiredText(value, field, max = 65535) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new TypeError(`AuthIdentity requires ${field}.`);
  if (raw.length > max) throw new TypeError(`AuthIdentity ${field} exceeds maximum length.`);
  return raw;
}

function nullableText(value, max = 65535) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length > max) throw new TypeError("AuthIdentity text field exceeds maximum length.");
  return raw;
}

module.exports = {
  AUTH_IDENTITY_ID_MAX_LENGTH,
  AUTH_IDENTITY_ID_PATTERN,
  AUTH_IDENTITY_J12_SOURCE_ID_PATTERN,
  AUTH_IDENTITY_SOURCE_USER_ID_MAX_LENGTH,
  AUTH_IDENTITY_USERS_SOURCE_ID_PATTERN,
  AuthIdentity,
  normalizeAuthIdentityId,
  normalizeAuthIdentitySourceUserId,
};
