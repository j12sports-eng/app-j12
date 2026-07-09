const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipStatisticsService } = require("../services/index.js");

test("ChampionshipStatisticsService calculates championship, team and athlete statistics", async () => {
  const { service, statisticsRepository } = createStatisticsHarness();

  const result = await service.findStatistics("camp-1");

  assert.equal(result.championship.matchesPlayed, 4);
  assert.equal(result.championship.finishedMatches, 3);
  assert.equal(result.championship.goalsScored, 3);
  assert.equal(result.championship.goalsAverage, 1);
  assert.equal(result.championship.yellowCards, 1);
  assert.equal(result.championship.redCards, 1);
  assert.equal(result.championship.walkovers, 1);

  const teamA = result.teams.find((team) => team.registrationId === "insc-a");
  assert.equal(teamA.matches, 2);
  assert.equal(teamA.wins, 1);
  assert.equal(teamA.draws, 1);
  assert.equal(teamA.goalsFor, 2);
  assert.equal(teamA.goalsAgainst, 1);
  assert.equal(teamA.goalDifference, 1);
  assert.equal(teamA.performance, 66.67);
  assert.deepEqual(teamA.resultStreak, ["V", "E"]);

  const scorer = result.athletes.find((athlete) => athlete.playerId === "player-a1");
  assert.equal(scorer.goals, 2);
  assert.equal(scorer.matches, 1);

  assert.equal(result.rankings.topScorers[0].playerId, "player-a1");
  assert.equal(result.rankings.fairPlay[0].registrationId, "insc-a");
  assert.equal(result.rankings.bestAttack[0].registrationId, "insc-c");
  assert.equal(result.rankings.bestDefense[0].registrationId, "insc-c");
  assert.equal(statisticsRepository.saved.championship.finishedMatches, 3);
});

test("ChampionshipStatisticsService filters rankings and artilharia", async () => {
  const { service } = createStatisticsHarness();

  const rankings = await service.findRankings("camp-1", {
    limit: 1,
    type: "artilharia",
  });
  const topScorers = await service.findTopScorers("camp-1", { limit: 1 });

  assert.equal(rankings.rankings.topScorers.length, 1);
  assert.equal(rankings.rankings.topScorers[0].playerId, "player-a1");
  assert.equal(rankings.rankings.bestAttack.length, 0);
  assert.equal(topScorers.items.length, 1);
  assert.equal(topScorers.items[0].goals, 2);
});

test("ChampionshipStatisticsService rejects missing championships", async () => {
  const { service } = createStatisticsHarness({ championships: [] });

  await assert.rejects(() => service.recalculate("camp-1"), /Campeonato nao encontrado/);
});

function createStatisticsHarness(options = {}) {
  const championshipRepository = {
    championships: options.championships || [{ id: "camp-1", name: "Copa J12" }],
    async findById(id) {
      return this.championships.find((championship) => championship.id === id) || null;
    },
  };
  const statisticsRepository = {
    saved: null,
    async fetchCalculationData() {
      return options.data || createCalculationData();
    },
    async replaceByChampionship(_championshipId, snapshot) {
      this.saved = snapshot;
      return snapshot;
    },
  };

  return {
    championshipRepository,
    service: new ChampionshipStatisticsService({
      championshipRepository,
      statisticsRepository,
    }),
    statisticsRepository,
  };
}

function createCalculationData() {
  return {
    events: [
      createEvent("evento-1", "report-1", "match-1", "GOAL", "insc-a", "player-a1", "Atleta A1"),
      createEvent("evento-2", "report-1", "match-1", "GOAL", "insc-a", "player-a1", "Atleta A1"),
      createEvent("evento-3", "report-1", "match-1", "GOAL", "insc-b", "player-b1", "Atleta B1"),
      createEvent(
        "evento-4",
        "report-1",
        "match-1",
        "YELLOW_CARD",
        "insc-a",
        "player-a2",
        "Atleta A2",
      ),
      createEvent("evento-5", "report-3", "match-3", "WALKOVER", "insc-c"),
      createEvent(
        "evento-6",
        "report-4",
        "match-4",
        "RED_CARD",
        "insc-b",
        "player-b1",
        "Atleta B1",
      ),
    ],
    reports: [
      createReport("report-1", "match-1", "insc-a", "insc-b", 2, 1, "FINISHED", "2026-08-01"),
      createReport("report-2", "match-2", "insc-a", "insc-c", 0, 0, "FINISHED", "2026-08-02"),
      createReport("report-3", "match-3", "insc-c", "insc-b", 3, 0, "FINISHED", "2026-08-03"),
      createReport("report-4", "match-4", "insc-a", "insc-b", 0, 0, "OPEN", "2026-08-04"),
    ],
  };
}

function createReport(
  id,
  matchId,
  homeRegistrationId,
  awayRegistrationId,
  homeScore,
  awayScore,
  status,
  matchDate,
) {
  const teams = {
    "insc-a": { acronym: "A", id: "team-a", name: "Equipe A" },
    "insc-b": { acronym: "B", id: "team-b", name: "Equipe B" },
    "insc-c": { acronym: "C", id: "team-c", name: "Equipe C" },
  };

  return {
    awayRegistrationId,
    awayScore,
    awayTeamAcronym: teams[awayRegistrationId].acronym,
    awayTeamId: teams[awayRegistrationId].id,
    awayTeamName: teams[awayRegistrationId].name,
    championshipId: "camp-1",
    homeRegistrationId,
    homeScore,
    homeTeamAcronym: teams[homeRegistrationId].acronym,
    homeTeamId: teams[homeRegistrationId].id,
    homeTeamName: teams[homeRegistrationId].name,
    id,
    matchDate,
    matchId,
    matchStatus: status === "FINISHED" ? "FINISHED" : "SCHEDULED",
    roundNumber: Number(matchId.replace("match-", "")),
    startTime: "09:00",
    status,
  };
}

function createEvent(
  id,
  reportId,
  matchId,
  eventType,
  teamRegistrationId,
  playerId = null,
  playerName = null,
) {
  const teams = {
    "insc-a": { acronym: "A", id: "team-a", name: "Equipe A" },
    "insc-b": { acronym: "B", id: "team-b", name: "Equipe B" },
    "insc-c": { acronym: "C", id: "team-c", name: "Equipe C" },
  };
  const team = teams[teamRegistrationId];

  return {
    championshipId: "camp-1",
    eventType,
    id,
    matchId,
    minute: 10,
    playerId,
    playerName,
    playerShirtNumber: playerId ? 10 : null,
    reportId,
    teamAcronym: team.acronym,
    teamId: team.id,
    teamName: team.name,
    teamRegistrationId,
  };
}
