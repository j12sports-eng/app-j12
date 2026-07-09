const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipGroupService } = require("../services/index.js");
const { RegistrationStatus } = require("../../shared/enums/index.js");

test("ChampionshipGroupService creates, lists and updates groups", async () => {
  const { groupRepository, service } = createGroupHarness();

  const created = await service.create(
    "camp-1",
    { name: "Grupo A" },
    { auth: { email: "admin@j12.test" } },
  );
  assert.equal(created.name, "Grupo A");
  assert.equal(created.displayOrder, 1);
  assert.equal(groupRepository.groups[0].createdBy, "admin@j12.test");

  const updated = await service.update("camp-1", created.id, {
    displayOrder: 4,
    name: "Grupo Alpha",
  });
  assert.equal(updated.name, "Grupo Alpha");
  assert.equal(updated.displayOrder, 4);

  const list = await service.findAll("camp-1");
  assert.equal(list.total, 1);
  assert.equal(list.items[0].id, created.id);
});

test("ChampionshipGroupService assigns, moves and removes registrations", async () => {
  const { service } = createGroupHarness({
    groups: [
      { championshipId: "camp-1", displayOrder: 1, id: "grupo-1", name: "Grupo A" },
      { championshipId: "camp-1", displayOrder: 2, id: "grupo-2", name: "Grupo B" },
    ],
  });

  const assigned = await service.assignRegistration("camp-1", "grupo-1", {
    registrationId: "insc-1",
  });
  assert.equal(assigned.registrations.length, 1);
  assert.equal(assigned.registrations[0].drawPosition, 1);

  const moved = await service.moveRegistration("camp-1", "grupo-1", "insc-1", {
    targetGroupId: "grupo-2",
  });
  assert.equal(moved.id, "grupo-2");
  assert.equal(moved.registrations[0].registrationId, "insc-1");

  const removed = await service.removeRegistration("camp-1", "grupo-2", "insc-1");
  assert.equal(removed.registrations.length, 0);
});

test("ChampionshipGroupService blocks duplicate group names and duplicate assignments", async () => {
  const { service } = createGroupHarness({
    groups: [{ championshipId: "camp-1", id: "grupo-1", name: "Grupo A" }],
  });

  await assert.rejects(
    () => service.create("camp-1", { name: "Grupo A" }),
    /Ja existe grupo com este nome/,
  );

  await service.assignRegistration("camp-1", "grupo-1", { registrationId: "insc-1" });
  await assert.rejects(
    () => service.assignRegistration("camp-1", "grupo-1", { registrationId: "insc-1" }),
    /ja esta vinculada/,
  );
});

test("ChampionshipGroupService distributes active registrations without creating game fixtures", async () => {
  const { service } = createGroupHarness({
    registrations: [
      {
        championshipId: "camp-1",
        id: "insc-1",
        status: RegistrationStatus.CONFIRMED,
        teamName: "Equipe A",
      },
      {
        championshipId: "camp-1",
        id: "insc-2",
        status: RegistrationStatus.PENDING,
        teamName: "Equipe B",
      },
      {
        championshipId: "camp-1",
        id: "insc-3",
        status: RegistrationStatus.CANCELLED,
        teamName: "Equipe C",
      },
    ],
  });

  const result = await service.drawGroups("camp-1", { groupCount: 2 });
  assert.equal(result.total, 2);
  assert.equal(
    result.items.reduce((total, group) => total + group.registrations.length, 0),
    2,
  );
});

test("ChampionshipGroupService rejects cancelled registrations", async () => {
  const { service } = createGroupHarness({
    groups: [{ championshipId: "camp-1", id: "grupo-1", name: "Grupo A" }],
    registrations: [
      { championshipId: "camp-1", id: "insc-1", status: RegistrationStatus.CANCELLED },
    ],
  });

  await assert.rejects(
    () => service.assignRegistration("camp-1", "grupo-1", { registrationId: "insc-1" }),
    /cancelada nao pode/,
  );
});

function createGroupHarness(options = {}) {
  const championshipRepository = {
    championships: options.championships || [{ id: "camp-1", name: "Copa J12" }],
    async findById(id) {
      return this.championships.find((championship) => championship.id === id) || null;
    },
  };
  const registrationRepository = {
    registrations: options.registrations || [
      {
        championshipId: "camp-1",
        id: "insc-1",
        status: RegistrationStatus.CONFIRMED,
        teamAcronym: "A",
        teamId: "team-1",
        teamName: "Equipe A",
      },
      {
        championshipId: "camp-1",
        id: "insc-2",
        status: RegistrationStatus.PENDING,
        teamAcronym: "B",
        teamId: "team-2",
        teamName: "Equipe B",
      },
    ],
    async findAll(filters = {}) {
      const items = this.registrations
        .filter((registration) => registration.championshipId === filters.championshipId)
        .sort((left, right) => String(left.teamName || "").localeCompare(right.teamName || ""));
      return { items, total: items.length };
    },
    async findById(id) {
      return this.registrations.find((registration) => registration.id === id) || null;
    },
  };
  const groupRepository = createInMemoryGroupRepository(
    options.groups || [],
    registrationRepository,
  );

  return {
    championshipRepository,
    groupRepository,
    registrationRepository,
    service: new ChampionshipGroupService({
      championshipRepository,
      groupRepository,
      registrationRepository,
    }),
  };
}

function createInMemoryGroupRepository(initialGroups, registrationRepository) {
  return {
    assignments: [],
    groups: initialGroups.map((group, index) => ({
      championshipId: "camp-1",
      displayOrder: index + 1,
      registrations: [],
      ...group,
    })),
    async addRegistration(input) {
      const assignment = {
        id: `grupo-insc-${this.assignments.length + 1}`,
        ...input,
      };
      this.assignments.push(assignment);
      return assignment;
    },
    async clearAssignments(championshipId) {
      const groupIds = this.groups
        .filter((group) => group.championshipId === championshipId)
        .map((group) => group.id);
      this.assignments = this.assignments.filter(
        (assignment) => !groupIds.includes(assignment.groupId),
      );
    },
    async countRegistrations(groupId) {
      return this.assignments.filter((assignment) => assignment.groupId === groupId).length;
    },
    async create(input) {
      const group = {
        displayOrder: 0,
        id: input.id || `grupo-${this.groups.length + 1}`,
        registrations: [],
        ...input,
      };
      this.groups.push(group);
      return this.findById(group.championshipId, group.id);
    },
    async delete(championshipId, groupId) {
      const group = await this.findById(championshipId, groupId);
      this.groups = this.groups.filter((item) => item.id !== groupId);
      return group;
    },
    async findAllByChampionship(filters = {}) {
      const items = this.groups
        .filter((group) => group.championshipId === filters.championshipId)
        .map((group) => this.withRegistrations(group))
        .sort((left, right) => left.displayOrder - right.displayOrder);
      return { items, total: items.length };
    },
    async findAssignmentByRegistration(championshipId, registrationId) {
      const groupIds = this.groups
        .filter((group) => group.championshipId === championshipId)
        .map((group) => group.id);
      return (
        this.assignments.find(
          (assignment) =>
            groupIds.includes(assignment.groupId) && assignment.registrationId === registrationId,
        ) || null
      );
    },
    async findById(championshipId, groupId) {
      const group =
        this.groups.find((item) => item.championshipId === championshipId && item.id === groupId) ||
        null;
      return group ? this.withRegistrations(group) : null;
    },
    async findByName(championshipId, name) {
      return (
        this.groups.find(
          (group) =>
            group.championshipId === championshipId &&
            String(group.name).toLowerCase() === String(name).toLowerCase(),
        ) || null
      );
    },
    async listAssignmentsByChampionship(championshipId) {
      const groupIds = this.groups
        .filter((group) => group.championshipId === championshipId)
        .map((group) => group.id);
      return this.assignments.filter((assignment) => groupIds.includes(assignment.groupId));
    },
    async moveRegistration(input) {
      const assignment = this.assignments.find(
        (item) => item.registrationId === input.registrationId,
      );
      if (assignment) {
        assignment.groupId = input.targetGroupId;
        assignment.drawPosition = input.drawPosition;
      }
      return assignment;
    },
    async removeRegistration(groupId, registrationId) {
      this.assignments = this.assignments.filter(
        (assignment) =>
          !(assignment.groupId === groupId && assignment.registrationId === registrationId),
      );
    },
    async replaceAssignments(_championshipId, assignments = []) {
      this.assignments = assignments.map((assignment, index) => ({
        id: `grupo-insc-${index + 1}`,
        ...assignment,
      }));
    },
    async update(championshipId, groupId, input) {
      const group = this.groups.find(
        (item) => item.championshipId === championshipId && item.id === groupId,
      );
      if (!group) return null;
      if (input.name !== undefined) group.name = input.name;
      if (input.displayOrder !== undefined) group.displayOrder = input.displayOrder;
      group.updatedBy = input.updatedBy;
      return this.withRegistrations(group);
    },
    withRegistrations(group) {
      const registrations = this.assignments
        .filter((assignment) => assignment.groupId === group.id)
        .map((assignment) => {
          const registration = registrationRepository.registrations.find(
            (item) => item.id === assignment.registrationId,
          );
          return {
            championshipId: group.championshipId,
            drawPosition: assignment.drawPosition,
            groupId: group.id,
            id: assignment.id,
            registrationId: assignment.registrationId,
            status: registration?.status || null,
            teamAcronym: registration?.teamAcronym || null,
            teamId: registration?.teamId || null,
            teamName: registration?.teamName || null,
          };
        });

      return { ...group, registrations };
    },
  };
}
