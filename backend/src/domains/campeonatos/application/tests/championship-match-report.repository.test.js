const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  MySqlChampionshipMatchReportRepository,
} = require("../../infrastructure/repositories/index.js");

test("MySqlChampionshipMatchReportRepository persists report and events with query runner", async () => {
  const { repository, state } = createRepositoryHarness();

  const report = await repository.createReport({
    championshipId: "camp-1",
    matchId: "jogo-1",
    referee: "Arbitro",
  });
  assert.equal(report.matchId, "jogo-1");
  assert.equal(report.match.homeTeamName, "Mandante");

  const event = await repository.createEvent({
    championshipId: "camp-1",
    eventType: "GOAL",
    matchId: "jogo-1",
    minute: 11,
    playerId: "player-home-1",
    reportId: report.id,
    teamRegistrationId: "insc-home",
  });
  assert.equal(event.eventType, "GOAL");
  assert.equal(event.playerName, "Camisa 10");

  const score = await repository.updateReportScore(report.id, {
    awayScore: 0,
    homeScore: 1,
    updatedBy: "admin@j12.test",
  });
  assert.equal(score.homeScore, 1);

  const status = await repository.updateReportStatus(report.id, {
    finishedAt: new Date("2026-08-10T12:00:00Z"),
    status: "FINISHED",
    updatedBy: "admin@j12.test",
  });
  assert.equal(status.status, "FINISHED");

  const updatedEvent = await repository.updateEvent(event.id, {
    description: "Gol de abertura",
    minute: 12,
  });
  assert.equal(updatedEvent.minute, 12);
  assert.equal(updatedEvent.description, "Gol de abertura");

  const removed = await repository.deleteEvent(event.id);
  assert.equal(removed.id, event.id);
  assert.equal(state.events.length, 0);
});

function createRepositoryHarness() {
  const state = {
    events: [],
    match: {
      away_registration_id: "insc-away",
      away_score: null,
      away_team_acronym: "VIS",
      away_team_id: "team-away",
      away_team_name: "Visitante",
      championship_id: "camp-1",
      court: "Quadra 1",
      created_at: "2026-08-01T00:00:00.000Z",
      created_by: null,
      group_id: "grupo-1",
      group_name: "Grupo A",
      home_registration_id: "insc-home",
      home_score: null,
      home_team_acronym: "MAN",
      home_team_id: "team-home",
      home_team_name: "Mandante",
      id: "jogo-1",
      match_date: "2026-08-10",
      phase: "GROUP_STAGE",
      round_id: "rodada-1",
      round_name: "Rodada 1",
      round_number: 1,
      start_time: "09:00",
      status: "SCHEDULED",
      updated_at: "2026-08-01T00:00:00.000Z",
      updated_by: null,
    },
    reports: [],
  };
  const repository = new MySqlChampionshipMatchReportRepository({
    playerSchemaRepository: { async ensureSchema() {} },
    queryRunner: (sql, params = []) => runFakeQuery(state, sql, params),
    roundSchemaRepository: { async ensureSchema() {} },
  });

  return { repository, state };
}

function runFakeQuery(state, sql, params = []) {
  const normalized = sql.replace(/\s+/g, " ").trim();

  if (normalized.startsWith("CREATE TABLE")) return [];

  if (normalized.startsWith("INSERT INTO j12_campeonato_sumulas")) {
    state.reports.push({
      assistant_referee: params[5],
      away_score: params[9],
      championship_id: params[2],
      created_at: "2026-08-01T00:00:00.000Z",
      created_by: params[10],
      finished_at: null,
      home_score: params[8],
      id: params[0],
      match_id: params[1],
      observations: params[7],
      referee: params[4],
      scorer: params[6],
      started_at: null,
      status: params[3],
      updated_at: "2026-08-01T00:00:00.000Z",
      updated_by: params[11],
    });
    return { affectedRows: 1 };
  }

  if (normalized.startsWith("INSERT INTO j12_campeonato_sumula_eventos")) {
    state.events.push({
      championship_id: params[3],
      created_at: "2026-08-01T00:00:00.000Z",
      created_by: params[12],
      description: params[10],
      event_type: params[7],
      id: params[0],
      match_id: params[2],
      metadata_json: params[11],
      minute: params[8],
      period: params[9],
      player_id: params[5],
      related_player_id: params[6],
      report_id: params[1],
      team_registration_id: params[4],
      updated_at: "2026-08-01T00:00:00.000Z",
      updated_by: params[13],
    });
    return { affectedRows: 1 };
  }

  if (normalized.includes("FROM j12_campeonato_sumulas report")) {
    if (normalized.includes("WHERE report.match_id = ?")) {
      return state.reports.filter((report) => report.match_id === params[0]);
    }
    if (normalized.includes("WHERE report.id = ?")) {
      return state.reports.filter((report) => report.id === params[0]);
    }
  }

  if (normalized.includes("FROM j12_campeonato_jogos match_item")) {
    return state.match.id === params[0] ? [state.match] : [];
  }

  if (normalized.startsWith("UPDATE j12_campeonato_sumulas") && normalized.includes("home_score")) {
    const report = state.reports.find((item) => item.id === params[3]);
    report.home_score = params[0];
    report.away_score = params[1];
    report.updated_by = params[2];
    return { affectedRows: 1 };
  }

  if (normalized.startsWith("UPDATE j12_campeonato_sumulas") && normalized.includes("status")) {
    const report = state.reports.find((item) => item.id === params.at(-1));
    let index = 0;
    if (normalized.includes("finished_at = ?")) report.finished_at = params[index++];
    if (normalized.includes("started_at = ?")) report.started_at = params[index++];
    if (normalized.includes("status = ?")) report.status = params[index++];
    report.updated_by = params[index];
    return { affectedRows: 1 };
  }

  if (normalized.startsWith("UPDATE j12_campeonato_sumulas")) {
    const report = state.reports.find((item) => item.id === params.at(-1));
    let index = 0;
    if (normalized.includes("assistant_referee = ?")) report.assistant_referee = params[index++];
    if (normalized.includes("observations = ?")) report.observations = params[index++];
    if (normalized.includes("referee = ?")) report.referee = params[index++];
    if (normalized.includes("scorer = ?")) report.scorer = params[index++];
    report.updated_by = params[index];
    return { affectedRows: 1 };
  }

  if (normalized.startsWith("UPDATE j12_campeonato_sumula_eventos")) {
    const event = state.events.find((item) => item.id === params.at(-1));
    let index = 0;
    if (normalized.includes("description = ?")) event.description = params[index++];
    if (normalized.includes("event_type = ?")) event.event_type = params[index++];
    if (normalized.includes("metadata_json = ?")) event.metadata_json = params[index++];
    if (normalized.includes("minute = ?")) event.minute = params[index++];
    if (normalized.includes("period = ?")) event.period = params[index++];
    if (normalized.includes("player_id = ?")) event.player_id = params[index++];
    if (normalized.includes("related_player_id = ?")) event.related_player_id = params[index++];
    if (normalized.includes("team_registration_id = ?"))
      event.team_registration_id = params[index++];
    event.updated_by = params[index];
    return { affectedRows: 1 };
  }

  if (normalized.includes("FROM j12_campeonato_sumula_eventos event_item")) {
    let rows = state.events;
    if (normalized.includes("WHERE event_item.report_id = ?") && normalized.includes("ORDER BY")) {
      rows = rows.filter((event) => event.report_id === params[0]);
    } else if (normalized.includes("WHERE event_item.id = ?")) {
      rows = rows.filter((event) => event.id === params[0]);
      if (normalized.includes("event_item.report_id = ?")) {
        rows = rows.filter((event) => event.report_id === params[1]);
      }
    }
    return rows.map(enrichEventRow);
  }

  if (normalized.startsWith("DELETE FROM j12_campeonato_sumula_eventos")) {
    const index = state.events.findIndex((event) => event.id === params[0]);
    if (index >= 0) state.events.splice(index, 1);
    return { affectedRows: index >= 0 ? 1 : 0 };
  }

  return [];
}

function enrichEventRow(row) {
  return {
    ...row,
    player_name: row.player_id === "player-home-1" ? "Camisa 10" : null,
    player_shirt_number: row.player_id === "player-home-1" ? 10 : null,
    related_player_name: null,
    related_player_shirt_number: null,
    team_acronym: row.team_registration_id === "insc-home" ? "MAN" : "VIS",
    team_name: row.team_registration_id === "insc-home" ? "Mandante" : "Visitante",
  };
}
