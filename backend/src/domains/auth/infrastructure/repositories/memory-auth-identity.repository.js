const { AuthIdentity, AuthIdentityStatus } = require("../../domain/index.js");

class InMemoryAuthIdentityRepository {
  constructor({ initialRows = [] } = {}) {
    this.byId = new Map();
    this.bySourceUser = new Map();

    for (const row of initialRows) {
      const identity = new AuthIdentity(row).toJSON();
      this.byId.set(identity.id, identity);
      this.bySourceUser.set(sourceUserKey(identity.source, identity.sourceUserId), identity.id);
    }
  }

  async create(input = {}) {
    const identity = new AuthIdentity(input).toJSON();
    const key = sourceUserKey(identity.source, identity.sourceUserId);

    if (this.bySourceUser.has(key) || this.byId.has(identity.id)) {
      throw duplicateAuthIdentityError();
    }

    this.byId.set(identity.id, clone(identity));
    this.bySourceUser.set(key, identity.id);
    return clone(identity);
  }

  async findById(id) {
    return clone(this.byId.get(String(id ?? "").trim()) || null);
  }

  async findBySourceUser(input = {}) {
    const probe = new AuthIdentity({
      id: "auth-identity-probe",
      source: input.source,
      sourceUserId: input.sourceUserId,
    });
    const id = this.bySourceUser.get(sourceUserKey(probe.source, probe.sourceUserId));
    return id ? this.findById(id) : null;
  }

  async disableIdentity(input = {}) {
    const id = String(input.identityId ?? input.id ?? "").trim();
    const row = this.byId.get(id);
    if (!row) return { changed: false, identity: null };
    if (row.status === AuthIdentityStatus.DISABLED) {
      return { changed: false, identity: clone(row) };
    }

    row.status = AuthIdentityStatus.DISABLED;
    row.disabledAt = String(input.disabledAt ?? "").trim() || new Date().toISOString();
    row.updatedAt = row.disabledAt;
    return { changed: true, identity: clone(row) };
  }
}

function sourceUserKey(source, sourceUserId) {
  return `${source}:${sourceUserId}`;
}

function duplicateAuthIdentityError() {
  const error = new Error("Duplicate AuthIdentity.");
  error.code = "ER_DUP_ENTRY";
  error.errno = 1062;
  error.sqlMessage = "Duplicate entry for key 'ux_auth_identities_source_user'";
  return error;
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = {
  InMemoryAuthIdentityRepository,
  duplicateAuthIdentityError,
};
