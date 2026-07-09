const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ChampionshipRegistrationPlayerService } = require("../services/index.js");
const { RegistrationStatus } = require("../../shared/enums/index.js");

test("ChampionshipRegistrationPlayerService creates and lists registration players", async () => {
  const { playerRepository, service } = createServiceHarness();

  const created = await service.create(
    "insc-1",
    {
      birthDate: "2012-05-10",
      name: "Ana Souza",
      position: "Ala",
      shirtNumber: 10,
    },
    { auth: { email: "admin@j12.test" } },
  );

  assert.equal(created.registrationId, "insc-1");
  assert.equal(created.name, "Ana Souza");
  assert.equal(created.shirtNumber, 10);
  assert.equal(playerRepository.items[0].createdBy, "admin@j12.test");

  const list = await service.findAll("insc-1", { search: "ana" });
  assert.equal(list.total, 1);
  assert.equal(list.items[0].id, created.id);
});

test("ChampionshipRegistrationPlayerService updates and fetches a player", async () => {
  const { service } = createServiceHarness({
    players: [{ id: "player-1", name: "Ana", registrationId: "insc-1", shirtNumber: 8 }],
  });

  const updated = await service.update("insc-1", "player-1", {
    document: "123",
    name: "Ana Clara",
    shirtNumber: 9,
  });

  assert.equal(updated.name, "Ana Clara");
  assert.equal(updated.document, "123");
  assert.equal(updated.shirtNumber, 9);

  const detail = await service.findById("insc-1", "player-1");
  assert.equal(detail.name, "Ana Clara");
});

test("ChampionshipRegistrationPlayerService deactivates players instead of removing history", async () => {
  const { service } = createServiceHarness({
    players: [
      {
        captain: true,
        id: "player-1",
        name: "Ana",
        registrationId: "insc-1",
        shirtNumber: 8,
      },
    ],
  });

  const deleted = await service.delete("insc-1", "player-1");

  assert.equal(deleted.active, false);
  assert.equal(deleted.captain, false);
});

test("ChampionshipRegistrationPlayerService keeps a single captain per registration", async () => {
  const { service } = createServiceHarness({
    players: [
      {
        captain: true,
        id: "player-1",
        name: "Ana",
        registrationId: "insc-1",
        shirtNumber: 8,
      },
      {
        captain: false,
        id: "player-2",
        name: "Bia",
        registrationId: "insc-1",
        shirtNumber: 9,
      },
    ],
  });

  const captain = await service.setCaptain("insc-1", "player-2");

  assert.equal(captain.captain, true);
  assert.equal(
    await service.findById("insc-1", "player-1").then((player) => player.captain),
    false,
  );
});

test("ChampionshipRegistrationPlayerService blocks duplicate shirt numbers", async () => {
  const { service } = createServiceHarness({
    players: [{ id: "player-1", name: "Ana", registrationId: "insc-1", shirtNumber: 8 }],
  });

  await assert.rejects(
    () => service.create("insc-1", { name: "Bia", shirtNumber: 8 }),
    /Numero de camisa ja utilizado/,
  );
});

test("ChampionshipRegistrationPlayerService rejects missing registration", async () => {
  const { service } = createServiceHarness({ registrations: [] });

  await assert.rejects(
    () => service.create("insc-missing", { name: "Ana", shirtNumber: 8 }),
    /Inscricao nao encontrada/,
  );
});

test("ChampionshipRegistrationPlayerService blocks changes on cancelled registration", async () => {
  const { service } = createServiceHarness({
    registrations: [{ id: "insc-1", status: RegistrationStatus.CANCELLED }],
  });

  await assert.rejects(
    () => service.create("insc-1", { name: "Ana", shirtNumber: 8 }),
    /Nao e permitido alterar atletas/,
  );
});

function createServiceHarness(options = {}) {
  const registrationRepository = {
    registrations: options.registrations || [
      { id: "insc-1", status: RegistrationStatus.CONFIRMED },
    ],
    async findById(id) {
      return this.registrations.find((registration) => registration.id === id) || null;
    },
  };
  const playerRepository = {
    items: (options.players || []).map((player) => ({ active: true, captain: false, ...player })),
    async create(payload) {
      const player = {
        active: true,
        captain: false,
        id: payload.id || `player-${this.items.length + 1}`,
        ...payload,
      };
      this.items.push(player);
      return player;
    },
    async deactivate(registrationId, playerId, payload) {
      const player = await this.findByRegistrationAndId(registrationId, playerId);
      Object.assign(player, { active: false, captain: false, updatedBy: payload.updatedBy });
      return player;
    },
    async findAllByRegistration(registrationId) {
      const items = this.items.filter((player) => player.registrationId === registrationId);
      return { items, total: items.length };
    },
    async findByRegistrationAndId(registrationId, playerId) {
      return (
        this.items.find(
          (player) => player.registrationId === registrationId && player.id === playerId,
        ) || null
      );
    },
    async findByRegistrationAndShirtNumber(registrationId, shirtNumber, ignoredPlayerId) {
      return (
        this.items.find(
          (player) =>
            player.registrationId === registrationId &&
            player.id !== ignoredPlayerId &&
            player.active !== false &&
            Number(player.shirtNumber) === Number(shirtNumber),
        ) || null
      );
    },
    async findCaptainByRegistration(registrationId) {
      return (
        this.items.find(
          (player) =>
            player.registrationId === registrationId &&
            player.active !== false &&
            player.captain === true,
        ) || null
      );
    },
    async setCaptain(registrationId, playerId, payload) {
      if (payload.captain !== false) {
        for (const player of this.items) {
          if (player.registrationId === registrationId && player.active !== false) {
            player.captain = false;
          }
        }
      }

      const player = await this.findByRegistrationAndId(registrationId, playerId);
      player.captain = payload.captain !== false;
      player.updatedBy = payload.updatedBy;
      return player;
    },
    async update(registrationId, playerId, payload) {
      const player = await this.findByRegistrationAndId(registrationId, playerId);
      Object.assign(player, payload);
      return player;
    },
  };

  return {
    playerRepository,
    registrationRepository,
    service: new ChampionshipRegistrationPlayerService({
      playerRepository,
      registrationRepository,
    }),
  };
}
