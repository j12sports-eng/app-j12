const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipMatchReportService } = require("../services/index.js");

test("ChampionshipMatchReportService creates report, records goal and syncs final score", async () => {
  const { matchReportRepository, roundService, service } = createMatchReportHarness();

  const created = await service.create(
    "jogo-1",
    { referee: "Arbitro 1", scorer: "Anotador" },
    { auth: { email: "admin@j12.test" } },
  );

  assert.equal(created.status, "DRAFT");
  assert.equal(matchReportRepository.reports[0].createdBy, "admin@j12.test");

  const opened = await service.open("jogo-1");
  assert.equal(opened.status, "OPEN");

  const withGoal = await service.createEvent("jogo-1", {
    eventType: "GOAL",
    minute: 12,
    playerId: "player-home-1",
    teamRegistrationId: "insc-home",
  });

  assert.equal(withGoal.homeScore, 1);
  assert.equal(withGoal.awayScore, 0);
  assert.equal(withGoal.events[0].playerName, "Camisa 10");

  const finalized = await service.finalize("jogo-1");
  assert.equal(finalized.status, "FINISHED");
  assert.deepEqual(roundService.updates[0], {
    championshipId: "camp-1",
    matchId: "jogo-1",
    payload: {
      awayScore: 0,
      homeScore: 1,
      status: "FINISHED",
    },
  });
});

test("ChampionshipMatchReportService rejects invalid athletes", async () => {
  const { service } = createMatchReportHarness();

  await service.create("jogo-1");

  await assert.rejects(
    () =>
      service.createEvent("jogo-1", {
        eventType: "GOAL",
        playerId: "player-away-1",
        teamRegistrationId: "insc-home",
      }),
    /Atleta nao encontrado/,
  );
});

test("ChampionshipMatchReportService validates final score against goal events", async () => {
  const { service } = createMatchReportHarness();

  await service.create("jogo-1");
  await service.createEvent("jogo-1", {
    eventType: "GOAL",
    playerId: "player-home-1",
    teamRegistrationId: "insc-home",
  });

  await assert.rejects(
    () => service.finalize("jogo-1", { awayScore: 0, homeScore: 3 }),
    /Placar final diverge/,
  );
});

test("ChampionshipMatchReportService blocks events after finalization and allows reopen", async () => {
  const { service } = createMatchReportHarness();

  await service.create("jogo-1");
  await service.finalize("jogo-1");

  await assert.rejects(
    () =>
      service.createEvent("jogo-1", {
        eventType: "YELLOW_CARD",
        playerId: "player-home-1",
        teamRegistrationId: "insc-home",
      }),
    /Sumula finalizada/,
  );

  const reopened = await service.reopen("jogo-1");
  assert.equal(reopened.status, "REOPENED");

  const withCard = await service.createEvent("jogo-1", {
    eventType: "YELLOW_CARD",
    playerId: "player-home-1",
    teamRegistrationId: "insc-home",
  });
  assert.equal(withCard.events.length, 1);
});

test("ChampionshipMatchReportService allows W.O. final score without goal events", async () => {
  const { roundService, service } = createMatchReportHarness();

  await service.create("jogo-1");
  await service.createEvent("jogo-1", {
    description: "Visitante nao compareceu",
    eventType: "WALKOVER",
    teamRegistrationId: "insc-home",
  });
  const finalized = await service.finalize("jogo-1", { awayScore: 0, homeScore: 3 });

  assert.equal(finalized.hasWalkover, true);
  assert.equal(finalized.homeScore, 3);
  assert.equal(roundService.updates[0].payload.homeScore, 3);
});

test("ChampionshipMatchReportService recalculates statistics after report changes", async () => {
  const statisticsService = {
    calls: [],
    async recalculate(championshipId) {
      this.calls.push(championshipId);
      return { championship: { championshipId } };
    },
  };
  const { service } = createMatchReportHarness({ statisticsService });

  await service.create("jogo-1");
  await service.open("jogo-1");
  await service.createEvent("jogo-1", {
    eventType: "YELLOW_CARD",
    playerId: "player-home-1",
    teamRegistrationId: "insc-home",
  });
  await service.updateEvent("jogo-1", "evento-1", { minute: 18 });
  await service.deleteEvent("jogo-1", "evento-1");
  await service.finalize("jogo-1");
  await service.reopen("jogo-1");

  assert.deepEqual(statisticsService.calls, [
    "camp-1",
    "camp-1",
    "camp-1",
    "camp-1",
    "camp-1",
    "camp-1",
    "camp-1",
  ]);
});

function createMatchReportHarness(options = {}) {
  const match = {
    awayRegistrationId: "insc-away",
    awayScore: null,
    awayTeamName: "Visitante",
    championshipId: "camp-1",
    court: "Quadra 1",
    groupId: "grupo-1",
    groupName: "Grupo A",
    homeRegistrationId: "insc-home",
    homeScore: null,
    homeTeamName: "Mandante",
    id: "jogo-1",
    matchDate: "2026-08-10",
    phase: "GROUP_STAGE",
    roundId: "rodada-1",
    roundNumber: 1,
    startTime: "09:00",
    status: "SCHEDULED",
  };
  const playerRepository = {
    players: [
      {
        active: true,
        id: "player-home-1",
        name: "Camisa 10",
        registrationId: "insc-home",
        shirtNumber: 10,
      },
      {
        active: true,
        id: "player-away-1",
        name: "Camisa 7",
        registrationId: "insc-away",
        shirtNumber: 7,
      },
    ],
    async findByRegistrationAndId(registrationId, playerId) {
      return (
        this.players.find(
          (player) => player.registrationId === registrationId && player.id === playerId,
        ) || null
      );
    },
  };
  const matchReportRepository = createInMemoryMatchReportRepository(match, playerRepository);
  const roundService = {
    updates: [],
    async updateMatch(championshipId, matchId, payload) {
      this.updates.push({ championshipId, matchId, payload });
      return { ...match, ...payload };
    },
  };

  return {
    match,
    matchReportRepository,
    playerRepository,
    roundService,
    service: new ChampionshipMatchReportService({
      matchReportRepository,
      playerRepository,
      roundService,
      statisticsService: options.statisticsService || null,
    }),
  };
}

function createInMemoryMatchReportRepository(match, playerRepository) {
  return {
    events: [],
    reports: [],
    async createReport(input) {
      const report = {
        awayScore: 0,
        events: [],
        homeScore: 0,
        id: `sumula-${this.reports.length + 1}`,
        status: "DRAFT",
        ...input,
      };
      this.reports.push(report);
      return this.findReportByMatchId(input.matchId);
    },
    async updateReport(reportId, input) {
      const report = this.reports.find((item) => item.id === reportId);
      Object.assign(report, removeUndefined(input));
      return this.findReportByMatchId(report.matchId);
    },
    async updateReportScore(reportId, input) {
      const report = this.reports.find((item) => item.id === reportId);
      Object.assign(report, {
        awayScore: input.awayScore,
        homeScore: input.homeScore,
        updatedBy: input.updatedBy || null,
      });
      return this.findReportByMatchId(report.matchId);
    },
    async updateReportStatus(reportId, input) {
      const report = this.reports.find((item) => item.id === reportId);
      Object.assign(report, removeUndefined(input));
      return this.findReportByMatchId(report.matchId);
    },
    async findReportByMatchId(matchId) {
      const report = this.reports.find((item) => item.matchId === matchId);
      if (!report) return null;
      return {
        ...report,
        events: await this.findEventsByReportId(report.id),
        match,
      };
    },
    async findMatchById(matchId) {
      return match.id === matchId ? { ...match } : null;
    },
    async createEvent(input) {
      const player = input.playerId
        ? await playerRepository.findByRegistrationAndId(input.teamRegistrationId, input.playerId)
        : null;
      const relatedPlayer = input.relatedPlayerId
        ? await playerRepository.findByRegistrationAndId(
            input.teamRegistrationId,
            input.relatedPlayerId,
          )
        : null;
      const event = {
        id: `evento-${this.events.length + 1}`,
        ...input,
        playerName: player?.name || null,
        playerShirtNumber: player?.shirtNumber || null,
        relatedPlayerName: relatedPlayer?.name || null,
        relatedPlayerShirtNumber: relatedPlayer?.shirtNumber || null,
        teamName:
          input.teamRegistrationId === match.homeRegistrationId
            ? match.homeTeamName
            : match.awayTeamName,
      };
      this.events.push(event);
      return this.findEventById(input.reportId, event.id);
    },
    async updateEvent(eventId, input) {
      const event = this.events.find((item) => item.id === eventId);
      Object.assign(event, removeUndefined(input));
      return this.findEventById(event.reportId, event.id);
    },
    async deleteEvent(eventId) {
      const index = this.events.findIndex((event) => event.id === eventId);
      return this.events.splice(index, 1)[0] || null;
    },
    async findEventById(reportId, eventId) {
      return (
        this.events.find(
          (event) => event.id === eventId && (!reportId || event.reportId === reportId),
        ) || null
      );
    },
    async findEventsByReportId(reportId) {
      return this.events.filter((event) => event.reportId === reportId);
    },
  };
}

function removeUndefined(input = {}) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => typeof value !== "undefined"),
  );
}
