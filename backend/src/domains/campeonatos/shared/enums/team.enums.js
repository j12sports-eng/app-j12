const TeamStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  DISQUALIFIED: "DISQUALIFIED",
  INACTIVE: "INACTIVE",
});

const TEAM_STATUSES = Object.freeze(Object.values(TeamStatus));

module.exports = {
  TEAM_STATUSES,
  TeamStatus,
};
