const { AuthIdentityApplicationService } = require("../application/index.js");
const { AuthIdentitySource } = require("../domain/index.js");
const { MySqlAuthIdentityRepository } = require("./repositories/mysql-auth-identity.repository.js");

function createAuthIdentityComposition(options = {}) {
  const needsRepositoryQueryRunner = !options.authIdentityRepository;
  const needsSourceQueryRunner =
    !options.sourceResolvers &&
    (!options.resolveJ12UsuariosSourceUser || !options.resolveUsersSourceUser);
  const queryRunner =
    options.queryRunner ||
    (needsRepositoryQueryRunner || needsSourceQueryRunner ? getDefaultQueryRunner() : null);
  const authIdentityRepository =
    options.authIdentityRepository ||
    new MySqlAuthIdentityRepository({ queryRunner });
  const sourceResolvers =
    options.sourceResolvers ||
    createAuthIdentitySourceResolvers({
      queryRunner,
      resolveJ12UsuariosSourceUser: options.resolveJ12UsuariosSourceUser,
      resolveUsersSourceUser: options.resolveUsersSourceUser,
    });
  const authIdentityService =
    options.authIdentityService ||
    new AuthIdentityApplicationService({
      authIdentityRepository,
      logger: options.logger,
      resolveJ12UsuariosSourceUser: sourceResolvers.resolveJ12UsuariosSourceUser,
      resolveUsersSourceUser: sourceResolvers.resolveUsersSourceUser,
    });

  return Object.freeze({
    authIdentityRepository,
    authIdentityService,
    sourceResolvers,
  });
}

function createAuthIdentitySourceResolvers({
  queryRunner = null,
  resolveJ12UsuariosSourceUser = null,
  resolveUsersSourceUser = null,
} = {}) {
  return Object.freeze({
    resolveJ12UsuariosSourceUser:
      resolveJ12UsuariosSourceUser ||
      (async ({ sourceUserId }) => {
        const query = queryRunner || getDefaultQueryRunner();
        if (!/^[1-9][0-9]{0,19}$/.test(String(sourceUserId ?? "").trim())) {
          return null;
        }
        const rows = await query(
          "SELECT id, status FROM j12_usuarios WHERE id = ? LIMIT 1",
          [String(sourceUserId)],
        );
        const row = readFirstRow(rows);
        return row
          ? {
              source: AuthIdentitySource.J12_USUARIOS,
              sourceUserId: String(row.id),
              status: row.status,
            }
          : null;
      }),
    resolveUsersSourceUser:
      resolveUsersSourceUser ||
      (async ({ sourceUserId }) => {
        const query = queryRunner || getDefaultQueryRunner();
        const id = String(sourceUserId ?? "").trim();
        if (!/^[A-Za-z0-9._:-]{1,64}$/.test(id)) return null;
        const rows = await query("SELECT id, status FROM users WHERE id = ? LIMIT 1", [id]);
        const row = readFirstRow(rows);
        return row
          ? {
              source: AuthIdentitySource.USERS,
              sourceUserId: String(row.id),
              status: row.status,
            }
          : null;
      }),
  });
}

function readFirstRow(result) {
  if (!Array.isArray(result) || result.length === 0) return null;
  const rows = Array.isArray(result[0]) ? result[0] : result;
  const row = rows[0];
  return row && typeof row === "object" && !Array.isArray(row) ? row : null;
}

function getDefaultQueryRunner() {
  return require("../../../config/db.js").query;
}

module.exports = {
  createAuthIdentityComposition,
  createAuthIdentitySourceResolvers,
};