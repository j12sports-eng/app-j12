const AuthIdentitySource = Object.freeze({
  J12_USUARIOS: "j12_usuarios",
  USERS: "users",
});

const AUTH_IDENTITY_SOURCE_VALUES = Object.freeze(Object.values(AuthIdentitySource));

function normalizeAuthIdentitySource(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return AUTH_IDENTITY_SOURCE_VALUES.includes(normalized) ? normalized : null;
}

function assertAuthIdentitySource(value) {
  const source = normalizeAuthIdentitySource(value);
  if (!source) {
    throw new TypeError("AuthIdentity source is not supported.");
  }
  return source;
}

module.exports = {
  AUTH_IDENTITY_SOURCE_VALUES,
  AuthIdentitySource,
  assertAuthIdentitySource,
  normalizeAuthIdentitySource,
};
