const {
  assertAuthIdentitySource,
} = require("../enums/auth-identity-source.enum.js");
const {
  assertUserUnitMembershipRole,
} = require("../enums/user-unit-membership-role.enum.js");
const {
  normalizeAuthIdentityId,
  normalizeAuthIdentitySourceUserId,
} = require("./auth-identity.entity.js");
const { UnitContext } = require("./unit-context.entity.js");

const ACTOR_CONTEXT_FIELDS = Object.freeze([
  "authenticatedAt",
  "authIdentityId",
  "correlationId",
  "globalRole",
  "issuedAt",
  "membershipRole",
  "requestId",
  "source",
  "sourceUserId",
  "unitContext",
]);

class ActorContext {
  constructor(input = {}) {
    assertExactFields(input, ACTOR_CONTEXT_FIELDS, "ActorContext");

    this.authIdentityId = requiredAuthIdentityId(input.authIdentityId);
    this.source = assertAuthIdentitySource(input.source);
    this.sourceUserId = normalizeAuthIdentitySourceUserId(input.sourceUserId, this.source);
    this.unitContext =
      input.unitContext instanceof UnitContext ? input.unitContext : new UnitContext(input.unitContext);
    this.requestId = requiredRuntimeId(input.requestId, "requestId");
    this.correlationId = requiredRuntimeId(input.correlationId, "correlationId");
    this.authenticatedAt = optionalText(input.authenticatedAt, 40);
    this.issuedAt = optionalText(input.issuedAt, 40);
    this.globalRole = optionalRole(input.globalRole);
    this.membershipRole = assertUserUnitMembershipRole(
      input.membershipRole || this.unitContext.membershipRole,
    );

    if (this.membershipRole !== this.unitContext.membershipRole) {
      throw new TypeError("ActorContext membershipRole must match UnitContext.");
    }

    Object.freeze(this);
  }

  toJSON() {
    const payload = {
      authIdentityId: this.authIdentityId,
      correlationId: this.correlationId,
      membershipRole: this.membershipRole,
      requestId: this.requestId,
      source: this.source,
      sourceUserId: this.sourceUserId,
      unitContext: this.unitContext.toJSON(),
    };

    if (this.authenticatedAt) payload.authenticatedAt = this.authenticatedAt;
    if (this.issuedAt) payload.issuedAt = this.issuedAt;
    if (this.globalRole) payload.globalRole = this.globalRole;

    return deepFreeze(payload);
  }
}

function requiredAuthIdentityId(value) {
  const id = normalizeAuthIdentityId(value);
  if (!id) throw new TypeError("ActorContext requires authIdentityId.");
  return id;
}

function requiredRuntimeId(value, field) {
  const normalized = optionalText(value, 128);
  if (!normalized) throw new TypeError(`ActorContext requires ${field}.`);
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new TypeError(`ActorContext ${field} has an invalid format.`);
  }
  return normalized;
}

function optionalRole(value) {
  const normalized = optionalText(value, 32);
  if (!normalized) return null;
  return assertUserUnitMembershipRole(normalized);
}

function optionalText(value, max) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (normalized.length > max) throw new TypeError("ActorContext text field exceeds maximum length.");
  return normalized;
}

function assertExactFields(input, allowedFields, name) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const allowed = new Set(allowedFields);
  const unexpected = Object.keys(source).filter((field) => !allowed.has(field));
  if (unexpected.length > 0) {
    throw new TypeError(`${name} does not accept additional fields.`);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

module.exports = {
  ACTOR_CONTEXT_FIELDS,
  ActorContext,
  deepFreeze,
};
