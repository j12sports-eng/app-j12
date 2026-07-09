const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipStandingService } = require("../services/index.js");
const { RegistrationStatus } = require("../../shared/enums/index.js");

test("ChampionshipStandingService calculates overall and grouped standings", async () => {
  const { service, standingRepository } = createStandingHarness({
    matches: [
      createMatch("jogo-1", "grupo-1", "insc-1", "insc-2", 2, 1),
      createMatch("jogo-2", "grupo-1", "insc-1", "insc-3", 0, 0),
      createMatch("jogo-3", "grupo-1", "insc-2", "insc-3", 3, 0),
      createMatch("jogo-4", "grupo-2", "insc-4", "insc-5", 1, 2),
      createMatch("jogo-5", "grupo-1", "insc-1", "insc-3", 9, 0, "CANCELLED"),
    ],
  });

  const result = await service.findAll("camp-1", {
    criteria: "points,wins,goalDifference,goalsFor,goalsAgainst,teamName",
  });

  assert.equal(result.total, 5);
  assert.deepEqual(
    result.items.map((item) => item.teamName),
    ["Equipe A", "Equipe B", "Equipe E", "Equipe C", "Equipe D"],
  );
  assert.equal(result.items[0].points, 4);
  assert.equal(result.items[0].played, 2);
  assert.equal(result.items[0].overallPosition, 1);
  assert.equal(result.groups.length, 2);
  assert.equal(result.groups[0].items[0].teamName, "Equipe A");
  assert.equal(standingRepository.items.length, 5);
});

test("ChampionshipStandingService filters standings by group", async () => {
  const { service } = createStandingHarness({
    matches: [createMatch("jogo-1", "grupo-2", "insc-4", "insc-5", 1, 2)],
  });

  const result = await service.findByGroup("camp-1", "grupo-2");

  assert.equal(result.total, 2);
  assert.deepEqual(
    result.items.map((item) => `${item.position}:${item.teamName}`),
    ["1:Equipe E", "2:Equipe D"],
  );
  assert.equal(result.groups.length, 0);
});

test("ChampionshipStandingService rejects missing championship and group", async () => {
  const { service } = createStandingHarness({
    championships: [],
  });

  await assert.rejects(() => service.findAll("camp-1"), /Campeonato nao encontrado/);

  const { service: groupService } = createStandingHarness();
  await assert.rejects(
    () => groupService.findByGroup("camp-1", "grupo-inexistente"),
    /Grupo nao encontrado/,
  );
});

function createStandingHarness(options = {}) {
  const championshipRepository = {
    championships: options.championships || [{ id: "camp-1", name: "Copa J12" }],
    async findById(id) {
      return this.championships.find((championship) => championship.id === id) || null;
    },
  };
  const groups = options.groups || [
    createGroup("grupo-1", "Grupo A", 1, [
      createGroupRegistration("grupo-1", "insc-1", "Equipe A", RegistrationStatus.CONFIRMED),
      createGroupRegistration("grupo-1", "insc-2", "Equipe B", RegistrationStatus.PENDING),
      createGroupRegistration("grupo-1", "insc-3", "Equipe C", RegistrationStatus.CONFIRMED),
      createGroupRegistration(
        "grupo-1",
        "insc-cancelada",
        "Equipe X",
        RegistrationStatus.CANCELLED,
      ),
    ]),
    createGroup("grupo-2", "Grupo B", 2, [
      createGroupRegistration("grupo-2", "insc-4", "Equipe D", RegistrationStatus.CONFIRMED),
      createGroupRegistration("grupo-2", "insc-5", "Equipe E", RegistrationStatus.CONFIRMED),
    ]),
  ];
  const groupRepository = {
    groups,
    async findAllByChampionship(filters = {}) {
      const items = this.groups
        .filter((group) => group.championshipId === filters.championshipId)
        .sort((left, right) => left.displayOrder - right.displayOrder);
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
  const roundRepository = {
    matches: options.matches || [],
    async findMatches(filters = {}) {
      const items = this.matches.filter(
        (match) =>
          match.championshipId === filters.championshipId &&
          (!filters.phase || match.phase === filters.phase),
      );
      return { items, total: items.length };
    },
  };
  const standingRepository = {
    items: [],
    async replaceByChampionship(championshipId, standings = []) {
      this.items = standings.map((standing, index) => ({
        id: `classificacao-${index + 1}`,
        ...standing,
        championshipId,
      }));
      return { items: this.items, total: this.items.length };
    },
  };

  return {
    championshipRepository,
    groupRepository,
    roundRepository,
    service: new ChampionshipStandingService({
      championshipRepository,
      groupRepository,
      roundRepository,
      standingRepository,
    }),
    standingRepository,
  };
}

function createGroup(id, name, displayOrder, registrations) {
  return {
    championshipId: "camp-1",
    displayOrder,
    id,
    name,
    registrations,
  };
}

function createGroupRegistration(groupId, registrationId, teamName, status) {
  return {
    championshipId: "camp-1",
    groupId,
    registrationId,
    status,
    teamAcronym: teamName.replace("Equipe ", ""),
    teamId: `team-${registrationId}`,
    teamName,
  };
}

function createMatch(
  id,
  groupId,
  homeRegistrationId,
  awayRegistrationId,
  homeScore,
  awayScore,
  status = "FINISHED",
) {
  const teamNames = {
    "insc-1": "Equipe A",
    "insc-2": "Equipe B",
    "insc-3": "Equipe C",
    "insc-4": "Equipe D",
    "insc-5": "Equipe E",
  };

  return {
    awayRegistrationId,
    awayScore,
    awayTeamName: teamNames[awayRegistrationId],
    championshipId: "camp-1",
    groupId,
    groupName: groupId === "grupo-1" ? "Grupo A" : "Grupo B",
    homeRegistrationId,
    homeScore,
    homeTeamName: teamNames[homeRegistrationId],
    id,
    phase: "GROUP_STAGE",
    status,
  };
}
