const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipRoundService } = require("../services/index.js");
const { RegistrationStatus } = require("../../shared/enums/index.js");

test("ChampionshipRoundService creates, lists and updates rounds", async () => {
  const { roundRepository, service } = createRoundHarness();

  const created = await service.createRound(
    "camp-1",
    { name: "Rodada 1" },
    { auth: { email: "admin@j12.test" } },
  );

  assert.equal(created.name, "Rodada 1");
  assert.equal(created.roundNumber, 1);
  assert.equal(roundRepository.rounds[0].createdBy, "admin@j12.test");

  const updated = await service.updateRound("camp-1", created.id, {
    name: "Primeira rodada",
    roundNumber: 2,
  });

  assert.equal(updated.name, "Primeira rodada");
  assert.equal(updated.roundNumber, 2);

  const list = await service.findRoundsByChampionship("camp-1", { limit: 20 });
  assert.equal(list.total, 1);
  assert.equal(list.items[0].id, created.id);
});

test("ChampionshipRoundService creates, moves and deletes matches", async () => {
  const { service } = createRoundHarness({
    rounds: [
      { championshipId: "camp-1", id: "rodada-1", phase: "GROUP_STAGE", roundNumber: 1 },
      { championshipId: "camp-1", id: "rodada-2", phase: "GROUP_STAGE", roundNumber: 2 },
    ],
  });

  const created = await service.createMatch("camp-1", "rodada-1", {
    groupId: "grupo-1",
    homeRegistrationId: "insc-1",
    awayRegistrationId: "insc-2",
    matchDate: "2026-08-10",
    startTime: "09:00",
    court: "Quadra 1",
  });

  assert.equal(created.homeTeamName, "Equipe A");
  assert.equal(created.awayTeamName, "Equipe B");

  const moved = await service.moveMatch("camp-1", created.id, {
    targetRoundId: "rodada-2",
  });
  assert.equal(moved.roundId, "rodada-2");

  const deleted = await service.deleteMatch("camp-1", created.id);
  assert.equal(deleted.id, created.id);
});

test("ChampionshipRoundService blocks duplicate matches and court conflicts", async () => {
  const { service } = createRoundHarness({
    matches: [
      {
        awayRegistrationId: "insc-2",
        championshipId: "camp-1",
        court: "Quadra 1",
        groupId: "grupo-1",
        homeRegistrationId: "insc-1",
        id: "jogo-1",
        matchDate: "2026-08-10",
        phase: "GROUP_STAGE",
        roundId: "rodada-1",
        startTime: "09:00",
        status: "SCHEDULED",
      },
    ],
    rounds: [{ championshipId: "camp-1", id: "rodada-1", phase: "GROUP_STAGE", roundNumber: 1 }],
  });

  await assert.rejects(
    () =>
      service.createMatch("camp-1", "rodada-1", {
        awayRegistrationId: "insc-1",
        groupId: "grupo-1",
        homeRegistrationId: "insc-2",
      }),
    /ja existe na fase/,
  );

  await assert.rejects(
    () =>
      service.createMatch("camp-1", "rodada-1", {
        awayRegistrationId: "insc-3",
        court: "quadra 1",
        groupId: "grupo-1",
        homeRegistrationId: "insc-2",
        matchDate: "2026-08-10",
        startTime: "09:00",
      }),
    /quadra e horario/,
  );
});

test("ChampionshipRoundService generates group-stage fixtures without standings", async () => {
  const { service } = createRoundHarness({
    groups: [
      createGroup("grupo-1", [
        createGroupRegistration("insc-1", 1, "Equipe A"),
        createGroupRegistration("insc-2", 2, "Equipe B"),
        createGroupRegistration("insc-3", 3, "Equipe C"),
      ]),
      createGroup("grupo-2", [
        createGroupRegistration("insc-4", 1, "Equipe D"),
        createGroupRegistration("insc-5", 2, "Equipe E"),
      ]),
    ],
    registrations: [
      createRegistration("insc-1", "Equipe A"),
      createRegistration("insc-2", "Equipe B"),
      createRegistration("insc-3", "Equipe C"),
      createRegistration("insc-4", "Equipe D"),
      createRegistration("insc-5", "Equipe E"),
    ],
  });

  const result = await service.generateMatches("camp-1", { replace: false });

  assert.equal(result.generated, 4);
  assert.equal(result.total, 3);
  assert.equal(
    result.items.reduce((total, round) => total + round.matches.length, 0),
    4,
  );
  assert.equal(Object.prototype.hasOwnProperty.call(result.items[0], "standings"), false);
});

test("ChampionshipRoundService rejects inactive registrations in manual matches", async () => {
  const { service } = createRoundHarness({
    registrations: [
      createRegistration("insc-1", "Equipe A"),
      createRegistration("insc-2", "Equipe B", RegistrationStatus.CANCELLED),
    ],
    rounds: [{ championshipId: "camp-1", id: "rodada-1", phase: "GROUP_STAGE", roundNumber: 1 }],
  });

  await assert.rejects(
    () =>
      service.createMatch("camp-1", "rodada-1", {
        awayRegistrationId: "insc-2",
        groupId: "grupo-1",
        homeRegistrationId: "insc-1",
      }),
    /pendentes ou confirmadas/,
  );
});

function createRoundHarness(options = {}) {
  const championshipRepository = {
    championships: options.championships || [{ id: "camp-1", name: "Copa J12" }],
    async findById(id) {
      return this.championships.find((championship) => championship.id === id) || null;
    },
  };
  const registrations = options.registrations || [
    createRegistration("insc-1", "Equipe A", RegistrationStatus.CONFIRMED),
    createRegistration("insc-2", "Equipe B", RegistrationStatus.PENDING),
    createRegistration("insc-3", "Equipe C", RegistrationStatus.CONFIRMED),
  ];
  const registrationRepository = {
    registrations,
    async findById(id) {
      return this.registrations.find((registration) => registration.id === id) || null;
    },
  };
  const groups = options.groups || [
    createGroup("grupo-1", [
      createGroupRegistration("insc-1", 1, "Equipe A"),
      createGroupRegistration("insc-2", 2, "Equipe B"),
      createGroupRegistration("insc-3", 3, "Equipe C"),
    ]),
  ];
  const groupRepository = {
    groups,
    async findAllByChampionship(filters = {}) {
      const items = this.groups.filter((group) => group.championshipId === filters.championshipId);
      return { items, total: items.length };
    },
    async findById(championshipId, groupId) {
      return (
        this.groups.find(
          (group) => group.championshipId === championshipId && group.id === groupId,
        ) || null
      );
    },
  };
  const roundRepository = createInMemoryRoundRepository(
    options.rounds || [],
    options.matches || [],
    groupRepository,
    registrationRepository,
  );

  return {
    championshipRepository,
    groupRepository,
    registrationRepository,
    roundRepository,
    service: new ChampionshipRoundService({
      championshipRepository,
      groupRepository,
      registrationRepository,
      roundRepository,
    }),
  };
}

function createInMemoryRoundRepository(
  initialRounds,
  initialMatches,
  groupRepository,
  registrationRepository,
) {
  return {
    matches: initialMatches.map((match) => ({ status: "SCHEDULED", ...match })),
    rounds: initialRounds.map((round, index) => ({
      championshipId: "camp-1",
      id: `rodada-${index + 1}`,
      matches: [],
      name: `Rodada ${index + 1}`,
      phase: "GROUP_STAGE",
      roundNumber: index + 1,
      ...round,
    })),
    async countMatchesByPhase(championshipId, phase) {
      return this.matches.filter(
        (match) => match.championshipId === championshipId && match.phase === phase,
      ).length;
    },
    async countMatchesByRound(roundId) {
      return this.matches.filter((match) => match.roundId === roundId).length;
    },
    async createMatch(input) {
      const match = {
        id: input.id || `jogo-${this.matches.length + 1}`,
        status: "SCHEDULED",
        ...input,
      };
      this.matches.push(match);
      return this.findMatchById(match.championshipId, match.id);
    },
    async createRound(input) {
      const round = {
        id: input.id || `rodada-${this.rounds.length + 1}`,
        matches: [],
        name: input.name || `Rodada ${input.roundNumber}`,
        ...input,
      };
      this.rounds.push(round);
      return this.findRoundById(round.championshipId, round.id);
    },
    async deleteMatch(championshipId, matchId) {
      const match = await this.findMatchById(championshipId, matchId);
      this.matches = this.matches.filter((item) => item.id !== matchId);
      return match;
    },
    async deleteMatchesByPhase(championshipId, phase) {
      this.matches = this.matches.filter(
        (match) => !(match.championshipId === championshipId && match.phase === phase),
      );
    },
    async deleteRound(championshipId, roundId) {
      const round = await this.findRoundById(championshipId, roundId);
      this.rounds = this.rounds.filter((item) => item.id !== roundId);
      return round;
    },
    async findCourtConflict(filters) {
      return (
        this.withMatchDetails(
          this.matches.find(
            (match) =>
              match.championshipId === filters.championshipId &&
              match.id !== filters.ignoredMatchId &&
              match.matchDate === filters.matchDate &&
              match.startTime === filters.startTime &&
              String(match.court || "").toLowerCase() ===
                String(filters.court || "").toLowerCase() &&
              match.status !== "CANCELLED",
          ),
        ) || null
      );
    },
    async findDuplicateMatch(filters) {
      const left = filters.homeRegistrationId;
      const right = filters.awayRegistrationId;
      return (
        this.withMatchDetails(
          this.matches.find(
            (match) =>
              match.championshipId === filters.championshipId &&
              match.phase === filters.phase &&
              match.groupId === filters.groupId &&
              match.id !== filters.ignoredMatchId &&
              ((match.homeRegistrationId === left && match.awayRegistrationId === right) ||
                (match.homeRegistrationId === right && match.awayRegistrationId === left)),
          ),
        ) || null
      );
    },
    async findMatchById(championshipId, matchId) {
      return this.withMatchDetails(
        this.matches.find(
          (match) => match.championshipId === championshipId && match.id === matchId,
        ) || null,
      );
    },
    async findMatches(filters = {}) {
      const items = this.matches
        .filter((match) => match.championshipId === filters.championshipId)
        .map((match) => this.withMatchDetails(match));
      return { items, total: items.length };
    },
    async findRoundById(championshipId, roundId) {
      const round =
        this.rounds.find((item) => item.championshipId === championshipId && item.id === roundId) ||
        null;
      return round ? this.withRoundMatches(round) : null;
    },
    async findRoundByNumber(championshipId, phase, roundNumber) {
      return (
        this.rounds.find(
          (round) =>
            round.championshipId === championshipId &&
            round.phase === phase &&
            Number(round.roundNumber) === Number(roundNumber),
        ) || null
      );
    },
    async findRoundsByChampionship(filters = {}) {
      const items = this.rounds
        .filter((round) => round.championshipId === filters.championshipId)
        .map((round) => this.withRoundMatches(round))
        .sort((left, right) => left.roundNumber - right.roundNumber);
      return { items, total: items.length };
    },
    async getNextRoundNumber(championshipId, phase) {
      return (
        this.rounds
          .filter((round) => round.championshipId === championshipId && round.phase === phase)
          .reduce((max, round) => Math.max(max, Number(round.roundNumber || 0)), 0) + 1
      );
    },
    async moveMatch(championshipId, matchId, input) {
      const match = this.matches.find(
        (item) => item.championshipId === championshipId && item.id === matchId,
      );
      if (match) {
        match.roundId = input.targetRoundId;
        match.phase = input.phase;
      }
      return this.findMatchById(championshipId, matchId);
    },
    async updateMatch(championshipId, matchId, input) {
      const match = this.matches.find(
        (item) => item.championshipId === championshipId && item.id === matchId,
      );
      if (!match) return null;
      Object.assign(match, input);
      return this.findMatchById(championshipId, matchId);
    },
    async updateRound(championshipId, roundId, input) {
      const round = this.rounds.find(
        (item) => item.championshipId === championshipId && item.id === roundId,
      );
      if (!round) return null;
      Object.assign(round, input);
      return this.withRoundMatches(round);
    },
    withMatchDetails(match) {
      if (!match) return null;
      const round = this.rounds.find((item) => item.id === match.roundId);
      const group = groupRepository.groups.find((item) => item.id === match.groupId);
      const home = registrationRepository.registrations.find(
        (item) => item.id === match.homeRegistrationId,
      );
      const away = registrationRepository.registrations.find(
        (item) => item.id === match.awayRegistrationId,
      );

      return {
        ...match,
        awayTeamAcronym: away?.teamAcronym || null,
        awayTeamId: away?.teamId || null,
        awayTeamName: away?.teamName || null,
        groupName: group?.name || null,
        homeTeamAcronym: home?.teamAcronym || null,
        homeTeamId: home?.teamId || null,
        homeTeamName: home?.teamName || null,
        roundName: round?.name || null,
        roundNumber: round?.roundNumber || 0,
      };
    },
    withRoundMatches(round) {
      return {
        ...round,
        matches: this.matches
          .filter((match) => match.roundId === round.id)
          .map((match) => this.withMatchDetails(match)),
      };
    },
  };
}

function createGroup(id, registrations) {
  return {
    championshipId: "camp-1",
    displayOrder: Number(id.replace(/\D/g, "")) || 1,
    id,
    name: id === "grupo-1" ? "Grupo A" : "Grupo B",
    registrations,
  };
}

function createGroupRegistration(registrationId, drawPosition, teamName) {
  return {
    championshipId: "camp-1",
    drawPosition,
    groupId: "grupo-1",
    id: `grupo-insc-${registrationId}`,
    registrationId,
    status: RegistrationStatus.CONFIRMED,
    teamName,
  };
}

function createRegistration(id, teamName, status = RegistrationStatus.CONFIRMED) {
  return {
    championshipId: "camp-1",
    id,
    status,
    teamAcronym: teamName.replace("Equipe ", ""),
    teamId: `team-${id}`,
    teamName,
  };
}
