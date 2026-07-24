const {
  assertUnitContextResolutionSource,
} = require("../enums/unit-context-resolution-source.enum.js");
const {
  assertUserUnitMembershipRole,
} = require("../enums/user-unit-membership-role.enum.js");
const {
  normalizeBooleanLike,
  normalizeMembershipId,
  normalizeUnitId,
} = require("./user-unit-membership.entity.js");

const UNIT_CONTEXT_FIELDS = Object.freeze([
  "isDefault",
  "membershipId",
  "membershipRole",
  "resolvedAt",
  "resolvedBy",
  "unitId",
]);

class UnitContext {
  constructor(input = {}) {
    assertExactFields(input, UNIT_CONTEXT_FIELDS, "UnitContext");

    this.unitId = normalizeUnitId(input.unitId);
    this.membershipId = requiredMembershipId(input.membershipId);
    this.membershipRole = assertUserUnitMembershipRole(input.membershipRole);
    this.isDefault = normalizeBooleanLike(input.isDefault, false);
    this.resolvedBy = assertUnitContextResolutionSource(input.resolvedBy);
    this.resolvedAt = requiredText(input.resolvedAt, "resolvedAt", 40);

    Object.freeze(this);
  }

  toJSON() {
    return Object.freeze({
      isDefault: this.isDefault,
      membershipId: this.membershipId,
      membershipRole: this.membershipRole,
      resolvedAt: this.resolvedAt,
      resolvedBy: this.resolvedBy,
      unitId: this.unitId,
    });
  }
}

function requiredMembershipId(value) {
  const id = normalizeMembershipId(value);
  if (!id) throw new TypeError("UnitContext requires membershipId.");
  return id;
}

function requiredText(value, field, max) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new TypeError(`UnitContext requires ${field}.`);
  if (normalized.length > max) throw new TypeError(`UnitContext ${field} exceeds maximum length.`);
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

module.exports = {
  UNIT_CONTEXT_FIELDS,
  UnitContext,
  assertExactFields,
};
