const assert = require("node:assert/strict");
const http = require("node:http");
const { test } = require("node:test");

const express = require("express");

const {
  createChampionshipAdminRouter,
  ensureChampionshipAdminAccess,
} = require("../routes/index.js");

test("championship admin router exposes CRUD endpoints", async () => {
  const calls = [];
  const service = {
    async create(payload) {
      calls.push(["create", payload]);
      return { id: "camp-1", ...payload };
    },
    async archive(id) {
      calls.push(["archive", id]);
      return { id, status: "ARCHIVED" };
    },
    async findAll(filters) {
      calls.push(["findAll", filters.status || ""]);
      return { items: [{ id: "camp-1", name: "Copa J12" }], limit: 100, total: 1 };
    },
    async findById(id) {
      calls.push(["findById", id]);
      return { id, name: "Copa J12" };
    },
    async remove(id) {
      calls.push(["remove", id]);
      return { id, status: "REMOVED" };
    },
    async publish(id) {
      calls.push(["publish", id]);
      return { id, status: "PUBLISHED" };
    },
    async update(id, payload) {
      calls.push(["update", id, payload]);
      return { id, ...payload };
    },
  };
  const server = await listen(createTestApp({ service }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const list = await fetchJson(`${baseUrl}/?status=DRAFT`);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.total, 1);

    const created = await fetchJson(`${baseUrl}/`, {
      body: JSON.stringify({
        category: "Livre",
        endDate: "2026-10-31",
        modality: "Futsal",
        name: "Copa J12",
        startDate: "2026-10-01",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.id, "camp-1");

    const updated = await fetchJson(`${baseUrl}/camp-1`, {
      body: JSON.stringify({ name: "Copa J12 Atualizada" }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.name, "Copa J12 Atualizada");

    const published = await fetchJson(`${baseUrl}/camp-1/publish`, { method: "POST" });
    assert.equal(published.status, 200);
    assert.equal(published.body.data.status, "PUBLISHED");

    const archived = await fetchJson(`${baseUrl}/camp-1/archive`, { method: "POST" });
    assert.equal(archived.status, 200);
    assert.equal(archived.body.data.status, "ARCHIVED");

    const removed = await fetchJson(`${baseUrl}/camp-1`, { method: "DELETE" });
    assert.equal(removed.status, 200);
    assert.equal(removed.body.data.status, "REMOVED");

    assert.deepEqual(
      calls.map((call) => call[0]),
      ["findAll", "create", "update", "publish", "archive", "remove"],
    );
  } finally {
    await closeServer(server);
  }
});

test("championship admin access policy documents future granular permissions without changing guard", () => {
  assert.equal(
    ensureChampionshipAdminAccess.accessPolicy.currentGuard,
    "requireAuth+canManageSystem",
  );
  assert.equal(
    ensureChampionshipAdminAccess.accessPolicy.granularPermissions.manage,
    "campeonatos.manage",
  );
});

test("championship admin router applies administrative access middleware", async () => {
  const server = await listen(
    createTestApp({
      accessMiddleware: (_req, res) => res.status(403).json({ success: false, error: "bloqueado" }),
      service: {
        async findAll() {
          return { items: [], limit: 100, total: 0 };
        },
      },
    }),
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const response = await fetchJson(`${baseUrl}/`);
    assert.equal(response.status, 403);
    assert.equal(response.body.success, false);
  } finally {
    await closeServer(server);
  }
});

test("championship admin router exposes team registration endpoints", async () => {
  const calls = [];
  const registrationService = {
    async cancel(id) {
      calls.push(["cancel", id]);
      return { id, status: "CANCELLED" };
    },
    async findAll(filters) {
      calls.push(["findAll", filters.championshipId || ""]);
      return { items: [{ id: "insc-1", teamId: "team-1" }], limit: 20, page: 1, total: 1 };
    },
    async findAvailableTeams(filters) {
      calls.push(["findAvailableTeams", filters.championshipId || ""]);
      return { items: [{ id: "team-2", name: "Equipe 2" }], limit: 20, page: 1, total: 1 };
    },
    async findById(id) {
      calls.push(["findById", id]);
      return { id, teamId: "team-1" };
    },
    async register(payload) {
      calls.push(["register", payload.championshipId, payload.teamId]);
      return { id: "insc-1", ...payload };
    },
    async updateStatus(id, payload) {
      calls.push(["updateStatus", id, payload.status]);
      return { id, status: payload.status };
    },
  };
  const server = await listen(createTestApp({ registrationService, service: createNoopService() }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const availableTeams = await fetchJson(
      `${baseUrl}/inscricoes/equipes-disponiveis?championshipId=camp-1`,
    );
    assert.equal(availableTeams.status, 200);
    assert.equal(availableTeams.body.data.total, 1);

    const list = await fetchJson(`${baseUrl}/camp-1/inscricoes`);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.items[0].id, "insc-1");

    const created = await fetchJson(`${baseUrl}/inscricoes`, {
      body: JSON.stringify({ championshipId: "camp-1", teamId: "team-1" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(created.status, 201);

    const detail = await fetchJson(`${baseUrl}/inscricoes/insc-1`);
    assert.equal(detail.status, 200);

    const status = await fetchJson(`${baseUrl}/inscricoes/insc-1/status`, {
      body: JSON.stringify({ status: "CONFIRMED" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    assert.equal(status.body.data.status, "CONFIRMED");

    const cancelled = await fetchJson(`${baseUrl}/inscricoes/insc-1/cancelar`, { method: "POST" });
    assert.equal(cancelled.body.data.status, "CANCELLED");

    assert.deepEqual(
      calls.map((call) => call[0]),
      ["findAvailableTeams", "findAll", "register", "findById", "updateStatus", "cancel"],
    );
  } finally {
    await closeServer(server);
  }
});

test("championship admin router exposes registration player endpoints", async () => {
  const calls = [];
  const playerService = {
    async create(registrationId, payload) {
      calls.push(["create", registrationId, payload.name]);
      return { id: "player-1", registrationId, ...payload };
    },
    async delete(registrationId, playerId) {
      calls.push(["delete", registrationId, playerId]);
      return { active: false, id: playerId, registrationId };
    },
    async findAll(registrationId, filters) {
      calls.push(["findAll", registrationId, filters.search || ""]);
      return { items: [{ id: "player-1", name: "Ana" }], limit: 20, page: 1, total: 1 };
    },
    async findById(registrationId, playerId) {
      calls.push(["findById", registrationId, playerId]);
      return { id: playerId, registrationId };
    },
    async setCaptain(registrationId, playerId) {
      calls.push(["setCaptain", registrationId, playerId]);
      return { captain: true, id: playerId, registrationId };
    },
    async update(registrationId, playerId, payload) {
      calls.push(["update", registrationId, playerId, payload.name]);
      return { id: playerId, registrationId, ...payload };
    },
  };
  const server = await listen(
    createTestApp({
      playerService,
      registrationService: createNoopRegistrationService(),
      service: createNoopService(),
    }),
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const list = await fetchJson(`${baseUrl}/inscricoes/insc-1/atletas?search=ana`);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.total, 1);

    const created = await fetchJson(`${baseUrl}/inscricoes/insc-1/atletas`, {
      body: JSON.stringify({ name: "Ana", shirtNumber: 10 }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.id, "player-1");

    const detail = await fetchJson(`${baseUrl}/inscricoes/insc-1/atletas/player-1`);
    assert.equal(detail.status, 200);

    const updated = await fetchJson(`${baseUrl}/inscricoes/insc-1/atletas/player-1`, {
      body: JSON.stringify({ name: "Ana Clara" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    assert.equal(updated.body.data.name, "Ana Clara");

    const captain = await fetchJson(`${baseUrl}/inscricoes/insc-1/atletas/player-1/capitao`, {
      body: JSON.stringify({ captain: true }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    assert.equal(captain.body.data.captain, true);

    const deleted = await fetchJson(`${baseUrl}/inscricoes/insc-1/atletas/player-1`, {
      method: "DELETE",
    });
    assert.equal(deleted.body.data.active, false);

    assert.deepEqual(
      calls.map((call) => call[0]),
      ["findAll", "create", "findById", "update", "setCaptain", "delete"],
    );
  } finally {
    await closeServer(server);
  }
});

test("championship admin router exposes group endpoints", async () => {
  const calls = [];
  const groupService = {
    async assignRegistration(championshipId, groupId, payload) {
      calls.push(["assignRegistration", championshipId, groupId, payload.registrationId]);
      return {
        championshipId,
        id: groupId,
        registrations: [{ registrationId: payload.registrationId }],
      };
    },
    async create(championshipId, payload) {
      calls.push(["create", championshipId, payload.name]);
      return { championshipId, id: "grupo-1", ...payload };
    },
    async drawGroups(championshipId, payload) {
      calls.push(["drawGroups", championshipId, payload.groupCount]);
      return { items: [], limit: 100, page: 1, total: 0 };
    },
    async findAll(championshipId, filters) {
      calls.push(["findAll", championshipId, filters.search || ""]);
      return { items: [{ id: "grupo-1", name: "Grupo A" }], limit: 20, page: 1, total: 1 };
    },
    async findById(championshipId, groupId) {
      calls.push(["findById", championshipId, groupId]);
      return { championshipId, id: groupId };
    },
    async moveRegistration(championshipId, groupId, registrationId, payload) {
      calls.push([
        "moveRegistration",
        championshipId,
        groupId,
        registrationId,
        payload.targetGroupId,
      ]);
      return { championshipId, id: payload.targetGroupId };
    },
    async redistributeGroups(championshipId, payload) {
      calls.push(["redistributeGroups", championshipId, payload.groupCount]);
      return { items: [], limit: 100, page: 1, total: 0 };
    },
    async remove(championshipId, groupId) {
      calls.push(["remove", championshipId, groupId]);
      return { championshipId, id: groupId };
    },
    async removeRegistration(championshipId, groupId, registrationId) {
      calls.push(["removeRegistration", championshipId, groupId, registrationId]);
      return { championshipId, id: groupId, registrations: [] };
    },
    async update(championshipId, groupId, payload) {
      calls.push(["update", championshipId, groupId, payload.name]);
      return { championshipId, id: groupId, ...payload };
    },
  };
  const server = await listen(
    createTestApp({
      groupService,
      playerService: createNoopPlayerService(),
      registrationService: createNoopRegistrationService(),
      service: createNoopService(),
    }),
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const list = await fetchJson(`${baseUrl}/camp-1/grupos?search=grupo`);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.total, 1);

    const created = await fetchJson(`${baseUrl}/camp-1/grupos`, {
      body: JSON.stringify({ name: "Grupo A" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.id, "grupo-1");

    const detail = await fetchJson(`${baseUrl}/camp-1/grupos/grupo-1`);
    assert.equal(detail.status, 200);

    const updated = await fetchJson(`${baseUrl}/camp-1/grupos/grupo-1`, {
      body: JSON.stringify({ name: "Grupo Alpha" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    assert.equal(updated.body.data.name, "Grupo Alpha");

    const assigned = await fetchJson(`${baseUrl}/camp-1/grupos/grupo-1/inscricoes`, {
      body: JSON.stringify({ registrationId: "insc-1" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(assigned.status, 201);

    const moved = await fetchJson(`${baseUrl}/camp-1/grupos/grupo-1/inscricoes/insc-1/mover`, {
      body: JSON.stringify({ targetGroupId: "grupo-2" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    assert.equal(moved.body.data.id, "grupo-2");

    const draw = await fetchJson(`${baseUrl}/camp-1/grupos/sortear`, {
      body: JSON.stringify({ groupCount: 2 }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(draw.status, 200);

    const redistributed = await fetchJson(`${baseUrl}/camp-1/grupos/redistribuir`, {
      body: JSON.stringify({ groupCount: 2 }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(redistributed.status, 200);

    const removedRegistration = await fetchJson(
      `${baseUrl}/camp-1/grupos/grupo-2/inscricoes/insc-1`,
      { method: "DELETE" },
    );
    assert.equal(removedRegistration.status, 200);

    const removedGroup = await fetchJson(`${baseUrl}/camp-1/grupos/grupo-1`, {
      method: "DELETE",
    });
    assert.equal(removedGroup.status, 200);

    assert.deepEqual(
      calls.map((call) => call[0]),
      [
        "findAll",
        "create",
        "findById",
        "update",
        "assignRegistration",
        "moveRegistration",
        "drawGroups",
        "redistributeGroups",
        "removeRegistration",
        "remove",
      ],
    );
  } finally {
    await closeServer(server);
  }
});

test("championship admin router exposes match report endpoints", async () => {
  const calls = [];
  const matchReportService = {
    async create(matchId, payload) {
      calls.push(["create", matchId, payload.referee || ""]);
      return { id: "sumula-1", matchId, status: "DRAFT" };
    },
    async createEvent(matchId, payload) {
      calls.push(["createEvent", matchId, payload.eventType]);
      return { events: [{ eventType: payload.eventType, id: "evento-1" }], id: "sumula-1" };
    },
    async deleteEvent(matchId, eventId) {
      calls.push(["deleteEvent", matchId, eventId]);
      return { events: [], id: "sumula-1" };
    },
    async finalize(matchId, payload) {
      calls.push(["finalize", matchId, payload.homeScore]);
      return { homeScore: payload.homeScore, id: "sumula-1", matchId, status: "FINISHED" };
    },
    async findByMatch(matchId) {
      calls.push(["findByMatch", matchId]);
      return { match: { id: matchId }, report: { id: "sumula-1", matchId } };
    },
    async open(matchId) {
      calls.push(["open", matchId]);
      return { id: "sumula-1", matchId, status: "OPEN" };
    },
    async reopen(matchId) {
      calls.push(["reopen", matchId]);
      return { id: "sumula-1", matchId, status: "REOPENED" };
    },
    async update(matchId, payload) {
      calls.push(["update", matchId, payload.scorer || ""]);
      return { id: "sumula-1", matchId, ...payload };
    },
    async updateEvent(matchId, eventId, payload) {
      calls.push(["updateEvent", matchId, eventId, payload.minute]);
      return { events: [{ id: eventId, minute: payload.minute }], id: "sumula-1" };
    },
  };
  const server = await listen(
    createTestApp({
      matchReportService,
      playerService: createNoopPlayerService(),
      registrationService: createNoopRegistrationService(),
      service: createNoopService(),
    }),
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const created = await fetchJson(`${baseUrl}/jogos/jogo-1/sumula`, {
      body: JSON.stringify({ referee: "Arbitro" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(created.status, 201);

    const detail = await fetchJson(`${baseUrl}/jogos/jogo-1/sumula`);
    assert.equal(detail.body.data.report.id, "sumula-1");

    const updated = await fetchJson(`${baseUrl}/jogos/jogo-1/sumula`, {
      body: JSON.stringify({ scorer: "Anotador" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    assert.equal(updated.body.data.scorer, "Anotador");

    const opened = await fetchJson(`${baseUrl}/jogos/jogo-1/sumula/abrir`, { method: "POST" });
    assert.equal(opened.body.data.status, "OPEN");

    const event = await fetchJson(`${baseUrl}/jogos/jogo-1/sumula/eventos`, {
      body: JSON.stringify({ eventType: "GOAL" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(event.status, 201);
    assert.equal(event.body.data.events[0].eventType, "GOAL");

    const eventUpdate = await fetchJson(`${baseUrl}/jogos/jogo-1/sumula/eventos/evento-1`, {
      body: JSON.stringify({ minute: 14 }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    assert.equal(eventUpdate.body.data.events[0].minute, 14);

    const eventDelete = await fetchJson(`${baseUrl}/jogos/jogo-1/sumula/eventos/evento-1`, {
      method: "DELETE",
    });
    assert.equal(eventDelete.body.data.events.length, 0);

    const finalized = await fetchJson(`${baseUrl}/jogos/jogo-1/sumula/finalizar`, {
      body: JSON.stringify({ awayScore: 1, homeScore: 2 }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(finalized.body.data.status, "FINISHED");

    const reopened = await fetchJson(`${baseUrl}/jogos/jogo-1/sumula/reabrir`, { method: "POST" });
    assert.equal(reopened.body.data.status, "REOPENED");

    assert.deepEqual(
      calls.map((call) => call[0]),
      [
        "create",
        "findByMatch",
        "update",
        "open",
        "createEvent",
        "updateEvent",
        "deleteEvent",
        "finalize",
        "reopen",
      ],
    );
  } finally {
    await closeServer(server);
  }
});

test("championship admin router exposes round and match endpoints", async () => {
  const calls = [];
  const roundService = {
    async createMatch(championshipId, roundId, payload) {
      calls.push(["createMatch", championshipId, roundId, payload.homeRegistrationId]);
      return { championshipId, id: "jogo-1", roundId, ...payload };
    },
    async createRound(championshipId, payload) {
      calls.push(["createRound", championshipId, payload.name]);
      return { championshipId, id: "rodada-1", ...payload };
    },
    async deleteMatch(championshipId, matchId) {
      calls.push(["deleteMatch", championshipId, matchId]);
      return { championshipId, id: matchId };
    },
    async deleteRound(championshipId, roundId) {
      calls.push(["deleteRound", championshipId, roundId]);
      return { championshipId, id: roundId };
    },
    async findMatches(championshipId, filters) {
      calls.push(["findMatches", championshipId, filters.status || ""]);
      return { items: [{ id: "jogo-1" }], limit: 20, page: 1, total: 1 };
    },
    async findRoundById(championshipId, roundId) {
      calls.push(["findRoundById", championshipId, roundId]);
      return { championshipId, id: roundId };
    },
    async findRoundsByChampionship(championshipId, filters) {
      calls.push(["findRoundsByChampionship", championshipId, filters.search || ""]);
      return { items: [{ id: "rodada-1" }], limit: 20, page: 1, total: 1 };
    },
    async generateMatches(championshipId, payload) {
      calls.push(["generateMatches", championshipId, payload.replace]);
      return { generated: 1, items: [], limit: 100, page: 1, total: 0 };
    },
    async moveMatch(championshipId, matchId, payload) {
      calls.push(["moveMatch", championshipId, matchId, payload.targetRoundId]);
      return { championshipId, id: matchId, roundId: payload.targetRoundId };
    },
    async updateMatch(championshipId, matchId, payload) {
      calls.push(["updateMatch", championshipId, matchId, payload.status]);
      return { championshipId, id: matchId, ...payload };
    },
    async updateRound(championshipId, roundId, payload) {
      calls.push(["updateRound", championshipId, roundId, payload.name]);
      return { championshipId, id: roundId, ...payload };
    },
  };
  const server = await listen(
    createTestApp({
      groupService: createNoopGroupService(),
      playerService: createNoopPlayerService(),
      registrationService: createNoopRegistrationService(),
      roundService,
      service: createNoopService(),
    }),
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const rounds = await fetchJson(`${baseUrl}/camp-1/rodadas?search=rodada`);
    assert.equal(rounds.status, 200);
    assert.equal(rounds.body.data.total, 1);

    const createdRound = await fetchJson(`${baseUrl}/camp-1/rodadas`, {
      body: JSON.stringify({ name: "Rodada 1" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(createdRound.status, 201);

    const detail = await fetchJson(`${baseUrl}/camp-1/rodadas/rodada-1`);
    assert.equal(detail.status, 200);

    const updatedRound = await fetchJson(`${baseUrl}/camp-1/rodadas/rodada-1`, {
      body: JSON.stringify({ name: "Rodada Alpha" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    assert.equal(updatedRound.body.data.name, "Rodada Alpha");

    const createdMatch = await fetchJson(`${baseUrl}/camp-1/rodadas/rodada-1/jogos`, {
      body: JSON.stringify({ homeRegistrationId: "insc-1", awayRegistrationId: "insc-2" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(createdMatch.status, 201);

    const matches = await fetchJson(`${baseUrl}/camp-1/jogos?status=SCHEDULED`);
    assert.equal(matches.status, 200);

    const updatedMatch = await fetchJson(`${baseUrl}/camp-1/jogos/jogo-1`, {
      body: JSON.stringify({ status: "POSTPONED" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    assert.equal(updatedMatch.body.data.status, "POSTPONED");

    const moved = await fetchJson(`${baseUrl}/camp-1/jogos/jogo-1/mover`, {
      body: JSON.stringify({ targetRoundId: "rodada-2" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    assert.equal(moved.body.data.roundId, "rodada-2");

    const generated = await fetchJson(`${baseUrl}/camp-1/rodadas/gerar-jogos`, {
      body: JSON.stringify({ replace: true }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(generated.body.data.generated, 1);

    const removedMatch = await fetchJson(`${baseUrl}/camp-1/jogos/jogo-1`, {
      method: "DELETE",
    });
    assert.equal(removedMatch.status, 200);

    const removedRound = await fetchJson(`${baseUrl}/camp-1/rodadas/rodada-1`, {
      method: "DELETE",
    });
    assert.equal(removedRound.status, 200);

    assert.deepEqual(
      calls.map((call) => call[0]),
      [
        "findRoundsByChampionship",
        "createRound",
        "findRoundById",
        "updateRound",
        "createMatch",
        "findMatches",
        "updateMatch",
        "moveMatch",
        "generateMatches",
        "deleteMatch",
        "deleteRound",
      ],
    );
  } finally {
    await closeServer(server);
  }
});

test("championship admin router exposes standing endpoints", async () => {
  const calls = [];
  const standingService = {
    async findAll(championshipId, filters) {
      calls.push(["findAll", championshipId, filters.criteria || ""]);
      return { items: [{ id: "classificacao-1" }], limit: 100, page: 1, total: 1 };
    },
    async findByGroup(championshipId, groupId, filters) {
      calls.push(["findByGroup", championshipId, groupId, filters.criteria || ""]);
      return { items: [{ id: "classificacao-2" }], limit: 100, page: 1, total: 1 };
    },
    async recalculate(championshipId, payload) {
      calls.push(["recalculate", championshipId, payload.criteria?.[0] || ""]);
      return { items: [], limit: 100, page: 1, total: 0 };
    },
  };
  const server = await listen(
    createTestApp({
      groupService: createNoopGroupService(),
      playerService: createNoopPlayerService(),
      registrationService: createNoopRegistrationService(),
      roundService: createNoopRoundService(),
      service: createNoopService(),
      standingService,
    }),
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const standings = await fetchJson(`${baseUrl}/camp-1/classificacao?criteria=points,wins`);
    assert.equal(standings.status, 200);
    assert.equal(standings.body.data.total, 1);

    const groupStandings = await fetchJson(
      `${baseUrl}/camp-1/grupos/grupo-1/classificacao?criteria=points`,
    );
    assert.equal(groupStandings.status, 200);

    const recalculated = await fetchJson(`${baseUrl}/camp-1/classificacao/recalcular`, {
      body: JSON.stringify({ criteria: ["points"] }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(recalculated.status, 200);

    assert.deepEqual(
      calls.map((call) => call[0]),
      ["findAll", "findByGroup", "recalculate"],
    );
  } finally {
    await closeServer(server);
  }
});

test("championship admin router exposes statistics and ranking endpoints", async () => {
  const calls = [];
  const statisticsService = {
    async findRankings(championshipId, filters) {
      calls.push(["findRankings", championshipId, filters.type || ""]);
      return { rankings: { topScorers: [{ playerId: "player-1" }] } };
    },
    async findStatistics(championshipId, filters) {
      calls.push(["findStatistics", championshipId, filters.limit || ""]);
      return { championship: { championshipId, finishedMatches: 1 }, teams: [] };
    },
    async findTopScorers(championshipId, filters) {
      calls.push(["findTopScorers", championshipId, filters.limit || ""]);
      return { items: [{ playerId: "player-1", goals: 2 }], total: 1 };
    },
    async recalculate(championshipId) {
      calls.push(["recalculate", championshipId]);
      return { championship: { championshipId, finishedMatches: 1 } };
    },
  };
  const server = await listen(
    createTestApp({
      groupService: createNoopGroupService(),
      playerService: createNoopPlayerService(),
      registrationService: createNoopRegistrationService(),
      roundService: createNoopRoundService(),
      service: createNoopService(),
      standingService: createNoopStandingService(),
      statisticsService,
    }),
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const statistics = await fetchJson(`${baseUrl}/camp-1/estatisticas?limit=5`);
    assert.equal(statistics.status, 200);
    assert.equal(statistics.body.data.championship.finishedMatches, 1);

    const rankings = await fetchJson(`${baseUrl}/camp-1/rankings?type=artilharia`);
    assert.equal(rankings.status, 200);
    assert.equal(rankings.body.data.rankings.topScorers[0].playerId, "player-1");

    const topScorers = await fetchJson(`${baseUrl}/camp-1/artilharia?limit=3`);
    assert.equal(topScorers.status, 200);
    assert.equal(topScorers.body.data.total, 1);

    const recalculated = await fetchJson(`${baseUrl}/camp-1/estatisticas/recalcular`, {
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(recalculated.status, 200);

    assert.deepEqual(
      calls.map((call) => call[0]),
      ["findStatistics", "findRankings", "findTopScorers", "recalculate"],
    );
  } finally {
    await closeServer(server);
  }
});

test("championship admin router exposes playoff endpoints", async () => {
  const calls = [];
  const bracketService = {
    async advanceMatch(matchId, payload) {
      calls.push(["advanceMatch", matchId, payload.winnerRegistrationId]);
      return { id: matchId, winnerRegistrationId: payload.winnerRegistrationId };
    },
    async deleteByChampionship(championshipId) {
      calls.push(["deleteByChampionship", championshipId]);
      return { championshipId, id: "chave-1" };
    },
    async findByChampionship(championshipId) {
      calls.push(["findByChampionship", championshipId]);
      return { championshipId, id: "chave-1", matches: [] };
    },
    async findByPhase(championshipId, phase) {
      calls.push(["findByPhase", championshipId, phase]);
      return { championshipId, id: "chave-1", matches: [{ phase }] };
    },
    async generate(championshipId, payload) {
      calls.push(["generate", championshipId, payload.teamCount]);
      return { championshipId, id: "chave-1", teamCount: payload.teamCount };
    },
    async updateMatch(matchId, payload) {
      calls.push(["updateMatch", matchId, payload.status]);
      return { id: matchId, status: payload.status };
    },
  };
  const server = await listen(
    createTestApp({
      bracketService,
      groupService: createNoopGroupService(),
      playerService: createNoopPlayerService(),
      registrationService: createNoopRegistrationService(),
      roundService: createNoopRoundService(),
      service: createNoopService(),
      standingService: createNoopStandingService(),
    }),
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const generated = await fetchJson(`${baseUrl}/camp-1/playoffs/gerar`, {
      body: JSON.stringify({ teamCount: 4 }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(generated.status, 201);
    assert.equal(generated.body.data.teamCount, 4);

    const detail = await fetchJson(`${baseUrl}/camp-1/playoffs`);
    assert.equal(detail.status, 200);

    const phase = await fetchJson(`${baseUrl}/camp-1/playoffs/SEMI_FINAL`);
    assert.equal(phase.status, 200);
    assert.equal(phase.body.data.matches[0].phase, "SEMI_FINAL");

    const updated = await fetchJson(`${baseUrl}/playoffs/matches/jogo-1`, {
      body: JSON.stringify({ status: "FINISHED" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    assert.equal(updated.body.data.status, "FINISHED");

    const advanced = await fetchJson(`${baseUrl}/playoffs/matches/jogo-1/avancar`, {
      body: JSON.stringify({ winnerRegistrationId: "insc-1" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(advanced.body.data.winnerRegistrationId, "insc-1");

    const removed = await fetchJson(`${baseUrl}/camp-1/playoffs`, {
      method: "DELETE",
    });
    assert.equal(removed.status, 200);

    assert.deepEqual(
      calls.map((call) => call[0]),
      [
        "generate",
        "findByChampionship",
        "findByPhase",
        "updateMatch",
        "advanceMatch",
        "deleteByChampionship",
      ],
    );
  } finally {
    await closeServer(server);
  }
});

function createTestApp(options) {
  const app = express();
  app.use(express.json());
  app.use(
    createChampionshipAdminRouter({
      accessMiddleware: options.accessMiddleware || ((_req, _res, next) => next()),
      authMiddleware: (req, _res, next) => {
        req.auth = { email: "admin@j12.test", role: "admin" };
        next();
      },
      bracketService: options.bracketService || createNoopBracketService(),
      championshipService: options.service,
      groupService: options.groupService || createNoopGroupService(),
      matchReportService: options.matchReportService || createNoopMatchReportService(),
      playerService: options.playerService,
      registrationService: options.registrationService,
      roundService: options.roundService || createNoopRoundService(),
      standingService: options.standingService || createNoopStandingService(),
      statisticsService: options.statisticsService || createNoopStatisticsService(),
    }),
  );
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  });
  return app;
}

function createNoopBracketService() {
  return {
    async advanceMatch(matchId, payload) {
      return { id: matchId, ...payload };
    },
    async deleteByChampionship(championshipId) {
      return { championshipId, id: "chave-1" };
    },
    async findByChampionship(championshipId) {
      return { championshipId, id: "chave-1", matches: [] };
    },
    async findByPhase(championshipId, phase) {
      return { championshipId, id: "chave-1", matches: [{ phase }] };
    },
    async generate(championshipId, payload) {
      return { championshipId, id: "chave-1", ...payload };
    },
    async updateMatch(matchId, payload) {
      return { id: matchId, ...payload };
    },
  };
}

function createNoopService() {
  return {
    async create(payload) {
      return { id: "camp-1", ...payload };
    },
    async findAll() {
      return { items: [], limit: 100, total: 0 };
    },
    async findById(id) {
      return { id, name: "Copa J12" };
    },
  };
}

function createNoopRegistrationService() {
  return {
    async cancel(id) {
      return { id, status: "CANCELLED" };
    },
    async findAll() {
      return { items: [], limit: 20, page: 1, total: 0 };
    },
    async findAvailableTeams() {
      return { items: [], limit: 20, page: 1, total: 0 };
    },
    async findById(id) {
      return { id, teamId: "team-1" };
    },
    async register(payload) {
      return { id: "insc-1", ...payload };
    },
    async updateStatus(id, payload) {
      return { id, status: payload.status };
    },
  };
}

function createNoopPlayerService() {
  return {
    async create(registrationId, payload) {
      return { id: "player-1", registrationId, ...payload };
    },
    async delete(registrationId, playerId) {
      return { active: false, id: playerId, registrationId };
    },
    async findAll() {
      return { items: [], limit: 20, page: 1, total: 0 };
    },
    async findById(registrationId, playerId) {
      return { id: playerId, registrationId };
    },
    async setCaptain(registrationId, playerId) {
      return { captain: true, id: playerId, registrationId };
    },
    async update(registrationId, playerId, payload) {
      return { id: playerId, registrationId, ...payload };
    },
  };
}

function createNoopGroupService() {
  return {
    async assignRegistration(championshipId, groupId, payload) {
      return {
        championshipId,
        id: groupId,
        registrations: [{ registrationId: payload.registrationId }],
      };
    },
    async create(championshipId, payload) {
      return { championshipId, id: "grupo-1", ...payload };
    },
    async drawGroups() {
      return { items: [], limit: 100, page: 1, total: 0 };
    },
    async findAll() {
      return { items: [], limit: 20, page: 1, total: 0 };
    },
    async findById(championshipId, groupId) {
      return { championshipId, id: groupId };
    },
    async moveRegistration(championshipId, _groupId, _registrationId, payload) {
      return { championshipId, id: payload.targetGroupId };
    },
    async redistributeGroups() {
      return { items: [], limit: 100, page: 1, total: 0 };
    },
    async remove(championshipId, groupId) {
      return { championshipId, id: groupId };
    },
    async removeRegistration(championshipId, groupId) {
      return { championshipId, id: groupId, registrations: [] };
    },
    async update(championshipId, groupId, payload) {
      return { championshipId, id: groupId, ...payload };
    },
  };
}

function createNoopMatchReportService() {
  return {
    async create(matchId, payload) {
      return { id: "sumula-1", matchId, ...payload };
    },
    async createEvent(matchId, payload) {
      return { events: [{ id: "evento-1", ...payload }], id: "sumula-1", matchId };
    },
    async deleteEvent(matchId) {
      return { events: [], id: "sumula-1", matchId };
    },
    async finalize(matchId, payload) {
      return { id: "sumula-1", matchId, status: "FINISHED", ...payload };
    },
    async findByMatch(matchId) {
      return { match: { id: matchId }, report: null };
    },
    async open(matchId) {
      return { id: "sumula-1", matchId, status: "OPEN" };
    },
    async reopen(matchId) {
      return { id: "sumula-1", matchId, status: "REOPENED" };
    },
    async update(matchId, payload) {
      return { id: "sumula-1", matchId, ...payload };
    },
    async updateEvent(matchId, eventId, payload) {
      return { events: [{ id: eventId, ...payload }], id: "sumula-1", matchId };
    },
  };
}

function createNoopRoundService() {
  return {
    async createMatch(championshipId, roundId, payload) {
      return { championshipId, id: "jogo-1", roundId, ...payload };
    },
    async createRound(championshipId, payload) {
      return { championshipId, id: "rodada-1", ...payload };
    },
    async deleteMatch(championshipId, matchId) {
      return { championshipId, id: matchId };
    },
    async deleteRound(championshipId, roundId) {
      return { championshipId, id: roundId };
    },
    async findMatches() {
      return { items: [], limit: 20, page: 1, total: 0 };
    },
    async findRoundById(championshipId, roundId) {
      return { championshipId, id: roundId };
    },
    async findRoundsByChampionship() {
      return { items: [], limit: 20, page: 1, total: 0 };
    },
    async generateMatches() {
      return { generated: 0, items: [], limit: 100, page: 1, total: 0 };
    },
    async moveMatch(championshipId, matchId, payload) {
      return { championshipId, id: matchId, roundId: payload.targetRoundId };
    },
    async updateMatch(championshipId, matchId, payload) {
      return { championshipId, id: matchId, ...payload };
    },
    async updateRound(championshipId, roundId, payload) {
      return { championshipId, id: roundId, ...payload };
    },
  };
}

function createNoopStandingService() {
  return {
    async findAll() {
      return { items: [], limit: 100, page: 1, total: 0 };
    },
    async findByGroup() {
      return { items: [], limit: 100, page: 1, total: 0 };
    },
    async recalculate() {
      return { items: [], limit: 100, page: 1, total: 0 };
    },
  };
}

function createNoopStatisticsService() {
  return {
    async findRankings() {
      return { rankings: { bestAttack: [], bestDefense: [], fairPlay: [], topScorers: [] } };
    },
    async findStatistics() {
      return { athletes: [], championship: null, teams: [] };
    },
    async findTopScorers() {
      return { items: [], total: 0 };
    },
    async recalculate() {
      return { athletes: [], championship: null, teams: [] };
    },
  };
}

function listen(app) {
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  return {
    body: await response.json(),
    status: response.status,
  };
}
