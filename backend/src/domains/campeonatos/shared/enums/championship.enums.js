const ChampionshipStatus = Object.freeze({
  ARCHIVED: "ARCHIVED",
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  REMOVED: "REMOVED",
});

const CHAMPIONSHIP_STATUSES = Object.freeze(Object.values(ChampionshipStatus));

module.exports = {
  CHAMPIONSHIP_STATUSES,
  ChampionshipStatus,
};
