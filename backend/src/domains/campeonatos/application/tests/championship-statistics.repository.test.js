const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  MySqlChampionshipStatisticsRepository,
} = require("../../infrastructure/repositories/index.js");

test("MySqlChampionshipStatisticsRepository fetches calculation data from reports and events", async () => {
  const executed = [];
  const repository = new MySqlChampionshipStatisticsRepository({
    matchReportSchemaRepository: { async ensureSchema() {} },
    async queryRunner(sql, params) {
      executed.push({ params, sql });

      if (sql.includes("FROM j12_campeonato_sumulas report")) {
        return [
          {
            away_registration_id: "insc-b",
            away_score: 1,
            away_team_acronym: "B",
            away_team_id: "team-b",
            away_team_name: "Equipe B",
            championship_id: "camp-1",
            home_registration_id: "insc-a",
            home_score: 2,
            home_team_acronym: "A",
            home_team_id: "team-a",
            home_team_name: "Equipe A",
            id: "report-1",
            match_id: "match-1",
            match_status: "FINISHED",
            status: "FINISHED",
          },
        ];
      }

      if (sql.includes("FROM j12_campeonato_sumula_eventos event_item")) {
        return [
          {
            championship_id: "camp-1",
            event_type: "GOAL",
            id: "event-1",
            match_id: "match-1",
            player_id: "player-1",
            player_name: "Camisa 10",
            report_id: "report-1",
            team_acronym: "A",
            team_id: "team-a",
            team_name: "Equipe A",
            team_registration_id: "insc-a",
          },
        ];
      }

      return [];
    },
  });

  const data = await repository.fetchCalculationData("camp-1");

  assert.equal(data.reports[0].homeTeamName, "Equipe A");
  assert.equal(data.events[0].playerName, "Camisa 10");
  assert.ok(executed.some((item) => item.sql.includes("j12_campeonato_estatisticas")));
});

test("MySqlChampionshipStatisticsRepository replaces persisted snapshots", async () => {
  const writes = [];
  const repository = new MySqlChampionshipStatisticsRepository({
    matchReportSchemaRepository: { async ensureSchema() {} },
    async queryRunner(sql) {
      if (sql.includes("FROM j12_campeonato_estatisticas") && sql.includes("LIMIT 1")) {
        return [
          {
            championship_id: "camp-1",
            finished_matches: 1,
            goals_average: 2,
            goals_scored: 2,
            id: "estatistica-1",
            matches_played: 1,
          },
        ];
      }

      if (sql.includes("FROM j12_campeonato_estatisticas_equipes")) {
        return [
          {
            championship_id: "camp-1",
            goals_for: 2,
            id: "estatistica-equipe-1",
            matches_played: 1,
            registration_id: "insc-a",
            team_name: "Equipe A",
          },
        ];
      }

      if (sql.includes("FROM j12_campeonato_estatisticas_atletas")) {
        return [
          {
            championship_id: "camp-1",
            goals: 2,
            id: "estatistica-atleta-1",
            matches_played: 1,
            player_id: "player-1",
            player_name: "Camisa 10",
            registration_id: "insc-a",
          },
        ];
      }

      return [];
    },
    async transactionRunner(work) {
      return work(async (sql, params) => {
        writes.push({ params, sql });
        return [];
      });
    },
  });

  const snapshot = await repository.replaceByChampionship("camp-1", {
    championship: {
      championshipId: "camp-1",
      finishedMatches: 1,
      goalsAverage: 2,
      goalsScored: 2,
      matchesPlayed: 1,
    },
    players: [{ goals: 2, matches: 1, playerId: "player-1", registrationId: "insc-a" }],
    teams: [{ goalsFor: 2, matches: 1, registrationId: "insc-a", teamName: "Equipe A" }],
  });

  assert.equal(snapshot.championship.finishedMatches, 1);
  assert.equal(snapshot.teams[0].teamName, "Equipe A");
  assert.equal(snapshot.players[0].goals, 2);
  assert.ok(writes.some((item) => item.sql.includes("DELETE FROM j12_campeonato_estatisticas")));
  assert.ok(
    writes.some((item) => item.sql.includes("INSERT INTO j12_campeonato_estatisticas_atletas")),
  );
});
