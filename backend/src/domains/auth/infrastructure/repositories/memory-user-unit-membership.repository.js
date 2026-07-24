const { randomUUID } = require("node:crypto");

const {
  UserUnitMembership,
  UserUnitMembershipStatus,
} = require("../../domain/index.js");

class InMemoryUserUnitMembershipRepository {
  constructor({ initialRows = [] } = {}) {
    this.byId = new Map();
    this.byIdentityUnit = new Map();

    for (const row of initialRows) {
      const membership = normalizeMembership(row).toJSON();
      this.index(membership);
    }
  }

  async create(input = {}) {
    const membership = normalizeMembership(input).toJSON();
    const key = identityUnitKey(membership.authIdentityId, membership.unitId);

    if (this.byId.has(membership.id) || this.byIdentityUnit.has(key)) {
      throw duplicateMembershipError("ux_user_unit_memberships_identity_unit");
    }

    if (membership.isDefault) {
      this.ensureNoDefaultConflict(membership.authIdentityId, null);
    }

    this.index(membership);
    return clone(membership);
  }

  async findById(id) {
    return clone(this.byId.get(String(id ?? "").trim()) || null);
  }

  async findByIdentityAndUnit(input = {}) {
    const key = identityUnitKey(requiredText(input.authIdentityId, "authIdentityId", 64), requiredUnitId(
      input.unitId,
    ));
    const id = this.byIdentityUnit.get(key);
    return id ? this.findById(id) : null;
  }

  async listByIdentity(authIdentityId) {
    const identityId = requiredText(authIdentityId, "authIdentityId", 64);
    return [...this.byId.values()]
      .filter((row) => row.authIdentityId === identityId)
      .sort(compareMemberships)
      .map(clone);
  }

  async listActiveByIdentity(authIdentityId) {
    const identityId = requiredText(authIdentityId, "authIdentityId", 64);
    return [...this.byId.values()]
      .filter((row) => row.authIdentityId === identityId && row.status === UserUnitMembershipStatus.ACTIVE)
      .sort(compareMemberships)
      .map(clone);
  }

  async revoke(input = {}) {
    const membership = this.byId.get(requiredText(input.membershipId, "membershipId", 64));
    if (!membership) return { changed: false, membership: null };
    if (membership.status === UserUnitMembershipStatus.REVOKED) {
      return { changed: false, membership: clone(membership) };
    }

    membership.status = UserUnitMembershipStatus.REVOKED;
    membership.isDefault = false;
    membership.revokedAt = nullableText(input.revokedAt, 32) || nowSqlDateTime();
    membership.revokedByAuthIdentityId = requiredText(
      input.revokedByAuthIdentityId,
      "revokedByAuthIdentityId",
      64,
    );
    membership.updatedAt = membership.revokedAt;
    return { changed: true, membership: clone(membership) };
  }

  async deactivate(input = {}) {
    const membership = this.byId.get(requiredText(input.membershipId, "membershipId", 64));
    if (!membership) return { changed: false, membership: null };
    if (membership.status === UserUnitMembershipStatus.INACTIVE) {
      return { changed: false, membership: clone(membership) };
    }
    if (membership.status === UserUnitMembershipStatus.REVOKED) {
      return { changed: false, membership: clone(membership) };
    }

    membership.status = UserUnitMembershipStatus.INACTIVE;
    membership.isDefault = false;
    membership.updatedAt = nullableText(input.deactivatedAt, 32) || nowSqlDateTime();
    return { changed: true, membership: clone(membership) };
  }

  async changeRole(input = {}) {
    const membership = this.byId.get(requiredText(input.membershipId, "membershipId", 64));
    if (!membership) return { changed: false, membership: null, previousRole: null };
    if (membership.status === UserUnitMembershipStatus.REVOKED) {
      return { changed: false, membership: clone(membership), previousRole: membership.role };
    }

    const nextRole = new UserUnitMembership({ ...membership, role: input.role }).role;
    if (nextRole === membership.role) {
      return { changed: false, membership: clone(membership), previousRole: membership.role };
    }

    const previousRole = membership.role;
    membership.role = nextRole;
    membership.updatedAt = nowSqlDateTime();
    return { changed: true, membership: clone(membership), previousRole };
  }

  async setDefault(input = {}) {
    const membership = this.byId.get(requiredText(input.membershipId, "membershipId", 64));
    if (!membership) return { changed: false, membership: null };
    if (membership.status !== UserUnitMembershipStatus.ACTIVE) {
      return { changed: false, membership: clone(membership) };
    }
    if (membership.isDefault) {
      return { changed: false, membership: clone(membership) };
    }

    this.ensureNoDefaultConflict(membership.authIdentityId, membership.id);
    membership.isDefault = true;
    membership.updatedAt = nowSqlDateTime();
    return { changed: true, membership: clone(membership) };
  }

  async clearDefaultByIdentity(authIdentityId) {
    const identityId = requiredText(authIdentityId, "authIdentityId", 64);
    let count = 0;

    for (const membership of this.byId.values()) {
      if (
        membership.authIdentityId === identityId &&
        membership.status === UserUnitMembershipStatus.ACTIVE &&
        membership.isDefault
      ) {
        membership.isDefault = false;
        membership.updatedAt = nowSqlDateTime();
        count += 1;
      }
    }

    return { changed: count > 0, count };
  }

  async setDefaultTransactionally(input = {}) {
    const membership = this.byId.get(requiredText(input.membershipId, "membershipId", 64));
    if (!membership) {
      return { changed: false, membership: null, previousDefault: null, reused: false };
    }
    if (membership.status !== UserUnitMembershipStatus.ACTIVE) {
      return { changed: false, membership: clone(membership), previousDefault: null, reused: false };
    }
    if (membership.isDefault) {
      return {
        changed: false,
        membership: clone(membership),
        previousDefault: clone(membership),
        reused: true,
      };
    }

    const previousDefault = [...this.byId.values()].find(
      (row) =>
        row.authIdentityId === membership.authIdentityId &&
        row.status === UserUnitMembershipStatus.ACTIVE &&
        row.isDefault &&
        row.id !== membership.id,
    );

    if (previousDefault) {
      previousDefault.isDefault = false;
      previousDefault.updatedAt = nowSqlDateTime();
    }

    this.ensureNoDefaultConflict(membership.authIdentityId, membership.id);
    membership.isDefault = true;
    membership.updatedAt = nowSqlDateTime();

    return {
      changed: true,
      membership: clone(membership),
      previousDefault: clone(previousDefault || null),
      reused: false,
    };
  }

  async checkActive(input = {}) {
    const membership = await this.findByIdentityAndUnit(input);
    if (!membership) return null;
    if (membership.status !== UserUnitMembershipStatus.ACTIVE) {
      return null;
    }
    return clone(membership);
  }

  index(membership) {
    this.byId.set(membership.id, membership);
    this.byIdentityUnit.set(identityUnitKey(membership.authIdentityId, membership.unitId), membership.id);
  }

  ensureNoDefaultConflict(authIdentityId, exceptMembershipId = null) {
    for (const membership of this.byId.values()) {
      if (
        membership.authIdentityId === authIdentityId &&
        membership.status === UserUnitMembershipStatus.ACTIVE &&
        membership.isDefault &&
        membership.id !== exceptMembershipId
      ) {
        throw duplicateMembershipError("ux_user_unit_memberships_active_default");
      }
    }
  }
}

function normalizeMembership(input = {}) {
  return input instanceof UserUnitMembership ? input : new UserUnitMembership(input);
}

function compareMemberships(left, right) {
  if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
  const byCreated = String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
  if (byCreated !== 0) return byCreated;
  return String(left.id).localeCompare(String(right.id));
}

function identityUnitKey(authIdentityId, unitId) {
  return `${requiredText(authIdentityId, "authIdentityId", 64)}:${requiredUnitId(unitId)}`;
}

function requiredUnitId(value) {
  const normalized = String(value ?? "").trim();
  if (!/^[1-9][0-9]{0,19}$/.test(normalized)) {
    throw new TypeError("InMemoryUserUnitMembershipRepository requires unitId.");
  }
  return normalized;
}

function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);
  if (!normalized) throw new TypeError(`InMemoryUserUnitMembershipRepository requires ${field}.`);
  return normalized;
}

function nullableText(value, max = 65535) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return raw.length > max ? raw.slice(0, max) : raw;
}

function duplicateMembershipError(indexName) {
  const error = new Error("Duplicate user-unit membership.");
  error.code = "ER_DUP_ENTRY";
  error.errno = 1062;
  error.sqlMessage = `Duplicate entry for key '${indexName}'`;
  return error;
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function nowSqlDateTime() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

module.exports = {
  InMemoryUserUnitMembershipRepository,
  duplicateMembershipError,
};
