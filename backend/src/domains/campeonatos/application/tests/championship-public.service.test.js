const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  CHAMPIONSHIP_PUBLIC_NOT_FOUND_CODE,
  ChampionshipPublicService,
} = require("../services/index.js");

test("championship public service lists only published championships with pagination", async () => {
  const service = createService();

  const result = await service.findAll({ limit: "1", page: "2", search: "copa" });

  assert.equal(result.limit, 1);
  assert.equal(result.page, 2);
  assert.equal(result.total, 2);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, "camp-public");
  assert.equal(result.items[0].status, "PUBLISHED");
  assert.equal(result.items[0].logo.publicUrl, "https://cdn.j12.test/copa.png");
  assert.equal(result.items[0].logo.storageKey, undefined);
  assertNoPrivatePayload(result);
});

test("championship public service hides private championships before calling sports services", async () => {
  const calls = [];
  const service = createService({
    publicRepository: {
      async findPublishedAll() {
        return { items: [], total: 0 };
      },
      async findPublishedById() {
        return null;
      },
      async findTeamsByChampionship() {
        calls.push("teams");
        return { items: [], total: 0 };
      },
    },
    roundService: {
      async findMatches() {
        calls.push("matches");
        return { items: [], limit: 100, page: 1, total: 0 };
      },
    },
  });

  await assert.rejects(
    () => service.findMatches("camp-private"),
    (error) => error.code === CHAMPIONSHIP_PUBLIC_NOT_FOUND_CODE && error.statusCode === 404,
  );
  assert.deepEqual(calls, []);
});

test("championship public service sanitizes groups, teams, matches and rankings", async () => {
  const service = createService();

  const groups = await service.findGroups("camp-public", { limit: "10" });
  assert.equal(groups.items[0].totalTeams, 1);
  assert.equal(groups.items[0].teams[0].teamName, "J12 Laranja");
  assert.equal(
    groups.items[0].teams.some((team) => team.status === "PENDING"),
    false,
  );

  const teams = await service.findTeams("camp-public", { limit: "5", page: "1" });
  assert.equal(teams.total, 1);
  assert.equal(teams.items[0].teamName, "J12 Laranja");
  assert.equal(teams.items[0].technicalCommission[0].role, "Treinador");
  assert.equal(teams.items[0].technicalCommission[0].phone, undefined);

  const matches = await service.findMatches("camp-public", { page: "1" });
  assert.equal(matches.items[0].home.teamName, "J12 Laranja");
  assert.equal(matches.items[0].score.home, 3);

  const standings = await service.findStandings("camp-public", {});
  assert.equal(standings.items[0].team.teamName, "J12 Laranja");
  assert.equal(standings.items[0].points, 6);

  const bracket = await service.findBracket("camp-public");
  assert.equal(bracket.matches[0].winner.teamName, "J12 Laranja");

  const statistics = await service.findStatistics("camp-public", { limit: "3" });
  assert.equal(statistics.totalTeams, 1);
  assert.equal(statistics.rankings.topScorers[0].playerName, "Ana");

  const topScorers = await service.findTopScorers("camp-public", { limit: "3" });
  assert.equal(topScorers.items[0].goals, 4);

  assertNoPrivatePayload({
    bracket,
    groups,
    matches,
    standings,
    statistics,
    teams,
    topScorers,
  });
});

function createService(overrides = {}) {
  return new ChampionshipPublicService({
    bracketService: overrides.bracketService || createBracketService(),
    groupService: overrides.groupService || createGroupService(),
    publicRepository: overrides.publicRepository || createPublicRepository(),
    roundService: overrides.roundService || createRoundService(),
    standingService: overrides.standingService || createStandingService(),
    statisticsService: overrides.statisticsService || createStatisticsService(),
  });
}

function createPublicRepository() {
  return {
    async findPublishedAll(filters) {
      assert.equal(filters.search, "copa");
      return {
        items: [createChampionship()],
        total: 2,
      };
    },
    async findPublishedById(championshipId) {
      return championshipId === "camp-public" ? createChampionship() : null;
    },
    async findTeamsByChampionship(filters) {
      assert.equal(filters.championshipId, "camp-public");
      return {
        items: [createTeam()],
        total: 1,
      };
    },
  };
}

function createGroupService() {
  return {
    async findAll(championshipId) {
      assert.equal(championshipId, "camp-public");
      return {
        items: [
          {
            championshipId,
            createdBy: "admin@j12.test",
            displayOrder: 1,
            id: "grupo-a",
            name: "Grupo A",
            registrations: [
              {
                drawPosition: 1,
                registrationId: "insc-public",
                status: "CONFIRMED",
                teamAcronym: "J12",
                teamId: "team-public",
                teamName: "J12 Laranja",
                updatedBy: "admin@j12.test",
              },
              {
                drawPosition: 2,
                registrationId: "insc-pending",
                status: "PENDING",
                teamName: "Equipe Pendente",
              },
            ],
            updatedBy: "admin@j12.test",
          },
        ],
        limit: 10,
        page: 1,
        total: 1,
      };
    },
  };
}

function createRoundService() {
  return {
    async findMatches(championshipId) {
      assert.equal(championshipId, "camp-public");
      return {
        items: [
          {
            awayRegistrationId: "insc-away",
            awayScore: 1,
            awayTeamName: "Visitante",
            championshipId,
            createdBy: "admin@j12.test",
            homeRegistrationId: "insc-public",
            homeScore: 3,
            homeTeamName: "J12 Laranja",
            id: "jogo-1",
            matchDate: "2026-08-01",
            roundNumber: 1,
            status: "FINISHED",
            updatedBy: "admin@j12.test",
          },
        ],
        limit: 100,
        page: 1,
        total: 1,
      };
    },
  };
}

function createStandingService() {
  return {
    async findAll(championshipId) {
      assert.equal(championshipId, "camp-public");
      return {
        calculatedAt: "2026-08-01T10:00:00.000Z",
        criteria: ["points"],
        groups: [],
        items: [
          {
            createdBy: "admin@j12.test",
            goalsAgainst: 1,
            goalsFor: 5,
            points: 6,
            registrationId: "insc-public",
            teamId: "team-public",
            teamName: "J12 Laranja",
            updatedBy: "admin@j12.test",
          },
        ],
        limit: 100,
        page: 1,
        total: 1,
      };
    },
  };
}

function createBracketService() {
  return {
    async findByChampionship(championshipId) {
      assert.equal(championshipId, "camp-public");
      return {
        championshipId,
        createdBy: "admin@j12.test",
        id: "chave-1",
        includeThirdPlace: false,
        matches: [
          {
            awayRegistrationId: "insc-away",
            championshipId,
            homeRegistrationId: "insc-public",
            homeTeamName: "J12 Laranja",
            id: "chave-jogo-1",
            phase: "FINAL",
            status: "FINISHED",
            updatedBy: "admin@j12.test",
            winnerRegistrationId: "insc-public",
            winnerTeamName: "J12 Laranja",
          },
        ],
        mode: "AUTOMATIC",
        status: "FINISHED",
      };
    },
  };
}

function createStatisticsService() {
  return {
    async findStatistics(championshipId) {
      assert.equal(championshipId, "camp-public");
      return {
        athletes: [
          {
            goals: 4,
            playerId: "player-1",
            playerName: "Ana",
            registrationId: "insc-public",
            teamName: "J12 Laranja",
            updatedAt: "2026-08-01T10:00:00.000Z",
          },
        ],
        championship: {
          championshipId,
          finishedMatches: 2,
          goalsScored: 8,
          id: "stats-1",
          updatedAt: "2026-08-01T10:00:00.000Z",
        },
        rankings: {
          topScorers: [
            {
              goals: 4,
              playerId: "player-1",
              playerName: "Ana",
              registrationId: "insc-public",
              teamName: "J12 Laranja",
            },
          ],
        },
        teams: [
          {
            goalsFor: 5,
            id: "team-stats-1",
            registrationId: "insc-public",
            teamName: "J12 Laranja",
            updatedAt: "2026-08-01T10:00:00.000Z",
          },
        ],
      };
    },
    async findTopScorers(championshipId) {
      assert.equal(championshipId, "camp-public");
      return {
        championshipId,
        items: [
          {
            goals: 4,
            playerId: "player-1",
            playerName: "Ana",
            registrationId: "insc-public",
            teamName: "J12 Laranja",
          },
        ],
        limit: 3,
        total: 1,
      };
    },
  };
}

function createChampionship() {
  return {
    category: "Sub-15",
    createdAt: "2026-07-01T10:00:00.000Z",
    createdBy: "admin@j12.test",
    description: "Copa publica",
    endDate: "2026-08-30",
    id: "camp-public",
    metadata: {
      internalNotes: "nao expor",
      logo: {
        publicUrl: "https://cdn.j12.test/copa.png",
        storageKey: "campeonatos/copa.png",
        uploadedBy: "admin@j12.test",
      },
    },
    modality: "Futsal",
    name: "Copa J12",
    publishedAt: "2026-07-10T10:00:00.000Z",
    startDate: "2026-08-01",
    status: "PUBLISHED",
    updatedBy: "admin@j12.test",
  };
}

function createTeam() {
  return {
    assistantCoach: "Auxiliar",
    category: "Sub-15",
    championshipId: "camp-public",
    coach: "Treinador",
    createdBy: "admin@j12.test",
    drawPosition: 1,
    groupId: "grupo-a",
    groupName: "Grupo A",
    logo: {
      publicUrl: "https://cdn.j12.test/equipe.png",
      storageKey: "equipes/equipe.png",
    },
    modality: "Futsal",
    observations: "interno",
    registrationId: "insc-public",
    status: "CONFIRMED",
    teamId: "team-public",
    teamName: "J12 Laranja",
    technicalCommission: [
      {
        email: "coach@j12.test",
        name: "Treinador",
        phone: "11999999999",
        role: "Treinador",
      },
    ],
    updatedBy: "admin@j12.test",
  };
}

function assertNoPrivatePayload(value) {
  const forbiddenKeys = new Set([
    "archivedAt",
    "cancelledAt",
    "checksum",
    "confirmedAt",
    "createdAt",
    "createdBy",
    "deletedAt",
    "document",
    "email",
    "internalNotes",
    "metadata",
    "observations",
    "phone",
    "refusedAt",
    "responsible",
    "resultUpdatedBy",
    "storageKey",
    "updatedAt",
    "updatedBy",
    "uploadedBy",
  ]);

  walk(value, (key) => {
    assert.equal(forbiddenKeys.has(key), false, `private key leaked: ${key}`);
  });
}

function walk(value, visitor) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    visitor(key);
    walk(child, visitor);
  }
}
