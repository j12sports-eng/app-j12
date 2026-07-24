const UserUnitMembershipStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  REVOKED: "REVOKED",
});

const USER_UNIT_MEMBERSHIP_STATUS_VALUES = Object.freeze(
  Object.values(UserUnitMembershipStatus),
);

function normalizeUserUnitMembershipStatus(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  return USER_UNIT_MEMBERSHIP_STATUS_VALUES.includes(normalized) ? normalized : null;
}

function assertUserUnitMembershipStatus(value) {
  const status = normalizeUserUnitMembershipStatus(value);
  if (!status) {
    throw new TypeError("UserUnitMembership status is not supported.");
  }
  return status;
}

module.exports = {
  USER_UNIT_MEMBERSHIP_STATUS_VALUES,
  UserUnitMembershipStatus,
  assertUserUnitMembershipStatus,
  normalizeUserUnitMembershipStatus,
};
