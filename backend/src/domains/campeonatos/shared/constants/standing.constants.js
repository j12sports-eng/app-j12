const CHAMPIONSHIP_STANDING_TABLE_NAME = "j12_campeonato_classificacao";
const CHAMPIONSHIP_STANDING_ROUTE_SEGMENT = "/classificacao";

const ChampionshipStandingTieBreaker = Object.freeze({
  DRAWS: "draws",
  GOAL_DIFFERENCE: "goalDifference",
  GOALS_AGAINST: "goalsAgainst",
  GOALS_FOR: "goalsFor",
  LOSSES: "losses",
  PLAYED: "played",
  POINTS: "points",
  TEAM_NAME: "teamName",
  WINS: "wins",
});

const CHAMPIONSHIP_STANDING_TIE_BREAKERS = Object.freeze(
  Object.values(ChampionshipStandingTieBreaker),
);

const CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS = Object.freeze([
  ChampionshipStandingTieBreaker.POINTS,
  ChampionshipStandingTieBreaker.WINS,
  ChampionshipStandingTieBreaker.GOAL_DIFFERENCE,
  ChampionshipStandingTieBreaker.GOALS_FOR,
  ChampionshipStandingTieBreaker.GOALS_AGAINST,
  ChampionshipStandingTieBreaker.TEAM_NAME,
]);

module.exports = {
  CHAMPIONSHIP_STANDING_DEFAULT_TIE_BREAKERS,
  CHAMPIONSHIP_STANDING_ROUTE_SEGMENT,
  CHAMPIONSHIP_STANDING_TABLE_NAME,
  CHAMPIONSHIP_STANDING_TIE_BREAKERS,
  ChampionshipStandingTieBreaker,
};
