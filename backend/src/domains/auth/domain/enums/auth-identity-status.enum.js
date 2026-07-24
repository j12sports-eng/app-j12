const AuthIdentityStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
});

const AUTH_IDENTITY_STATUS_VALUES = Object.freeze(Object.values(AuthIdentityStatus));

function normalizeAuthIdentityStatus(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  return AUTH_IDENTITY_STATUS_VALUES.includes(normalized) ? normalized : null;
}

function assertAuthIdentityStatus(value) {
  const status = normalizeAuthIdentityStatus(value);
  if (!status) {
    throw new TypeError("AuthIdentity status is not supported.");
  }
  return status;
}

module.exports = {
  AUTH_IDENTITY_STATUS_VALUES,
  AuthIdentityStatus,
  assertAuthIdentityStatus,
  normalizeAuthIdentityStatus,
};
