const {
  UserUnitMembershipApplicationService,
} = require("../application/services/user-unit-membership-application.service.js");
const { MySqlAuthIdentityRepository } = require("./repositories/mysql-auth-identity.repository.js");
const {
  MySqlUserUnitMembershipRepository,
} = require("./repositories/mysql-user-unit-membership.repository.js");

function createUserUnitMembershipComposition(options = {}) {
  const queryRunner = options.queryRunner || null;
  const transactionRunner = options.transactionRunner || null;
  const authIdentityRepository =
    options.authIdentityRepository ||
    new MySqlAuthIdentityRepository({ queryRunner: queryRunner || getDefaultQueryRunner() });
  const membershipRepository =
    options.membershipRepository ||
    new MySqlUserUnitMembershipRepository({
      queryRunner: queryRunner || getDefaultQueryRunner(),
      transactionRunner,
    });
  const authIdentityResolver =
    options.authIdentityResolver || createAuthIdentityResolver({ authIdentityRepository });
  const unitResolver = options.unitResolver || createUnitResolver({ queryRunner });
  const authorizeMembershipAction = options.authorizeMembershipAction || null;
  const membershipService =
    options.membershipService ||
    new UserUnitMembershipApplicationService({
      authIdentityResolver,
      authorizeMembershipAction,
      logger: options.logger,
      membershipRepository,
      unitResolver,
    });

  return Object.freeze({
    authIdentityRepository,
    authIdentityResolver,
    membershipRepository,
    membershipService,
    unitResolver,
  });
}

function createAuthIdentityResolver({ authIdentityRepository } = {}) {
  return async function resolveAuthIdentity({ authIdentityId }) {
    if (!authIdentityRepository || typeof authIdentityRepository.findById !== "function") {
      return null;
    }

    const row = await authIdentityRepository.findById(authIdentityId);
    if (!row) return null;

    return {
      id: String(row.id ?? "").trim(),
      status: String(row.status ?? "").trim(),
    };
  };
}

function createUnitResolver({ queryRunner = null } = {}) {
  return async function resolveUnit({ unitId }) {
    const query = queryRunner || getDefaultQueryRunner();
    const normalized = String(unitId ?? "").trim();
    if (!/^[1-9][0-9]{0,19}$/.test(normalized)) {
      return null;
    }

    const rows = await query("SELECT id, status FROM j12_unidades WHERE id = ? LIMIT 1", [
      normalized,
    ]);
    const row = readFirstRow(rows);
    return row
      ? {
          id: String(row.id),
          status: String(row.status ?? ""),
        }
      : null;
  };
}

function readFirstRow(result) {
  if (!Array.isArray(result) || result.length === 0) return null;
  const rows = Array.isArray(result[0]) ? result[0] : result;
  const row = rows[0];
  return row && typeof row === "object" && !Array.isArray(row) ? row : null;
}

function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

module.exports = {
  createAuthIdentityResolver,
  createUserUnitMembershipComposition,
  createUnitResolver,
};
