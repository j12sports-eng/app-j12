const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipRegistrationService } = require("../services/index.js");

test("ChampionshipRegistrationService registers a compatible team", async () => {
  const service = createService();

  const registration = await service.register(
    {
      championshipId: "camp-1",
      confirm: true,
      observations: "OK",
      teamId: "team-1",
    },
    { auth: { email: "admin@j12.test" } },
  );

  assert.equal(registration.championshipId, "camp-1");
  assert.equal(registration.teamId, "team-1");
  assert.equal(registration.status, "CONFIRMED");
  assert.equal(registration.createdBy, "admin@j12.test");
});

test("ChampionshipRegistrationService blocks duplicate team in same championship", async () => {
  const service = createService();

  await service.register({ championshipId: "camp-1", teamId: "team-1" });

  await assert.rejects(
    () => service.register({ championshipId: "camp-1", teamId: "team-1" }),
    /Equipe ja inscrita/,
  );
});

test("ChampionshipRegistrationService validates category compatibility", async () => {
  const service = createService({
    teams: [{ ...baseTeam("team-1"), category: "Sub-11" }],
  });

  await assert.rejects(
    () => service.register({ championshipId: "camp-1", teamId: "team-1" }),
    /Categoria da equipe/,
  );
});

test("ChampionshipRegistrationService validates modality compatibility", async () => {
  const service = createService({
    teams: [{ ...baseTeam("team-1"), modality: "Society" }],
  });

  await assert.rejects(
    () => service.register({ championshipId: "camp-1", teamId: "team-1" }),
    /Modalidade da equipe/,
  );
});

test("ChampionshipRegistrationService validates maximum teams", async () => {
  const service = createService({
    championships: [
      {
        ...baseChampionship("camp-1"),
        metadata: { maxTeams: 1 },
      },
    ],
    registrations: [
      {
        championshipId: "camp-1",
        id: "insc-existing",
        status: "CONFIRMED",
        teamId: "team-existing",
      },
    ],
  });

  await assert.rejects(
    () => service.register({ championshipId: "camp-1", teamId: "team-1" }),
    /Limite maximo/,
  );
});

test("ChampionshipRegistrationService blocks closed or cancelled championships", async () => {
  const archivedService = createService({
    championships: [{ ...baseChampionship("camp-1"), status: "ARCHIVED" }],
  });
  const cancelledService = createService({
    championships: [{ ...baseChampionship("camp-1"), metadata: { lifecycleStatus: "CANCELLED" } }],
  });

  await assert.rejects(
    () => archivedService.register({ championshipId: "camp-1", teamId: "team-1" }),
    /encerrados ou cancelados/,
  );
  await assert.rejects(
    () => cancelledService.register({ championshipId: "camp-1", teamId: "team-1" }),
    /encerrados ou cancelados/,
  );
});

test("ChampionshipRegistrationService cancels and updates registration status", async () => {
  const repository = createMemoryRegistrationRepository({
    registrations: [
      {
        championshipId: "camp-1",
        id: "insc-1",
        status: "PENDING",
        teamId: "team-1",
      },
    ],
  });
  const service = createService({ registrationRepository: repository });

  const confirmed = await service.updateStatus("insc-1", { status: "confirmada" });
  const cancelled = await service.cancel("insc-1");

  assert.equal(confirmed.status, "CONFIRMED");
  assert.equal(cancelled.status, "CANCELLED");
});

test("ChampionshipRegistrationService lists registrations and available teams", async () => {
  const service = createService();
  await service.register({ championshipId: "camp-1", teamId: "team-1" });

  const registrations = await service.findAll({ championshipId: "camp-1" });
  const availableTeams = await service.findAvailableTeams({ championshipId: "camp-1" });

  assert.equal(registrations.total, 1);
  assert.equal(registrations.items[0].teamId, "team-1");
  assert.equal(availableTeams.total, 1);
  assert.equal(availableTeams.items[0].id, "team-2");
});

function createService(options = {}) {
  const championshipRepository = createMemoryChampionshipRepository(options.championships);
  const registrationRepository =
    options.registrationRepository ||
    createMemoryRegistrationRepository({
      registrations: options.registrations,
      teams: options.teams,
    });

  return new ChampionshipRegistrationService({
    championshipRepository,
    registrationRepository,
  });
}

function createMemoryChampionshipRepository(championships = [baseChampionship("camp-1")]) {
  const records = new Map(championships.map((championship) => [championship.id, championship]));

  return {
    async findById(id) {
      return records.get(id) || null;
    },
  };
}

function createMemoryRegistrationRepository({
  registrations = [],
  teams = [baseTeam("team-1"), baseTeam("team-2")],
} = {}) {
  const records = new Map(registrations.map((registration) => [registration.id, registration]));
  const teamRecords = new Map(teams.map((team) => [team.id, team]));

  return {
    async countActiveByChampionship(championshipId) {
      return Array.from(records.values()).filter(
        (item) =>
          item.championshipId === championshipId &&
          ["PENDING", "CONFIRMED"].includes(item.status),
      ).length;
    },
    async create(values) {
      const team = teamRecords.get(values.teamId);
      const id = values.id || `insc-${records.size + 1}`;
      const registration = {
        cancelledAt: null,
        category: team?.category || null,
        championshipId: values.championshipId,
        createdAt: "2026-07-04T00:00:00.000Z",
        createdBy: values.createdBy,
        id,
        modality: team?.modality || null,
        observations: values.observations || null,
        status: values.status,
        teamAcronym: team?.acronym || null,
        teamId: values.teamId,
        teamName: team?.name || null,
        updatedAt: "2026-07-04T00:00:00.000Z",
        updatedBy: values.updatedBy,
      };
      records.set(id, registration);
      return registration;
    },
    async findAll(filters = {}) {
      const items = Array.from(records.values()).filter(
        (item) => !filters.championshipId || item.championshipId === filters.championshipId,
      );
      return { items, total: items.length };
    },
    async findAvailableTeams(filters = {}) {
      const registeredTeamIds = new Set(
        Array.from(records.values())
          .filter((item) => item.championshipId === filters.championshipId)
          .map((item) => item.teamId),
      );
      const items = Array.from(teamRecords.values()).filter(
        (team) =>
          !registeredTeamIds.has(team.id) &&
          team.category === filters.category &&
          team.modality === filters.modality,
      );
      return { items, total: items.length };
    },
    async findByChampionshipAndTeam(championshipId, teamId) {
      return (
        Array.from(records.values()).find(
          (item) => item.championshipId === championshipId && item.teamId === teamId,
        ) || null
      );
    },
    async findById(id) {
      return records.get(id) || null;
    },
    async findTeamById(id) {
      return teamRecords.get(id) || null;
    },
    async update(id, values) {
      const current = records.get(id);
      if (!current) return null;
      const next = {
        ...current,
        ...values,
        updatedAt: "2026-07-04T00:00:00.000Z",
      };
      records.set(id, next);
      return next;
    },
  };
}

function baseChampionship(id) {
  return {
    category: "Sub-13",
    id,
    metadata: {},
    modality: "Futsal",
    name: "Copa J12",
    status: "PUBLISHED",
  };
}

function baseTeam(id) {
  return {
    acronym: id.toUpperCase(),
    category: "Sub-13",
    id,
    modality: "Futsal",
    name: `Equipe ${id}`,
    status: "ACTIVE",
  };
}
