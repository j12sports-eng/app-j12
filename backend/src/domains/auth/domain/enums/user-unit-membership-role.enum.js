const UserUnitMembershipRole = Object.freeze({
  ADMIN: "admin",
  ALUNO: "aluno",
  COORDENADOR: "coordenador",
  PROFESSOR: "professor",
  RESPONSAVEL: "responsavel",
});

const USER_UNIT_MEMBERSHIP_ROLE_VALUES = Object.freeze(Object.values(UserUnitMembershipRole));

function normalizeUserUnitMembershipRole(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return USER_UNIT_MEMBERSHIP_ROLE_VALUES.includes(normalized) ? normalized : null;
}

function assertUserUnitMembershipRole(value) {
  const role = normalizeUserUnitMembershipRole(value);
  if (!role) {
    throw new TypeError("UserUnitMembership role is not supported.");
  }
  return role;
}

module.exports = {
  USER_UNIT_MEMBERSHIP_ROLE_VALUES,
  UserUnitMembershipRole,
  assertUserUnitMembershipRole,
  normalizeUserUnitMembershipRole,
};
