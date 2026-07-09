const assert = require("node:assert/strict");
const http = require("node:http");
const { test } = require("node:test");

const express = require("express");

const { createChampionshipPublicRouter } = require("../routes/index.js");

test("championship public router exposes read-only portal endpoints", async () => {
  const calls = [];
  const publicService = {
    async findAll(filters) {
      calls.push(["findAll", filters.page || ""]);
      return { items: [{ id: "camp-1" }], limit: 1, page: 2, total: 3 };
    },
    async findBracket(championshipId) {
      calls.push(["findBracket", championshipId]);
      return { championshipId, id: "chave-1", matches: [] };
    },
    async findById(championshipId) {
      calls.push(["findById", championshipId]);
      return { id: championshipId, name: "Copa J12" };
    },
    async findGroups(championshipId) {
      calls.push(["findGroups", championshipId]);
      return { items: [{ id: "grupo-1" }], limit: 100, page: 1, total: 1 };
    },
    async findMatches(championshipId) {
      calls.push(["findMatches", championshipId]);
      return { items: [{ id: "jogo-1" }], limit: 100, page: 1, total: 1 };
    },
    async findStandings(championshipId) {
      calls.push(["findStandings", championshipId]);
      return { items: [{ registrationId: "insc-1" }], limit: 100, page: 1, total: 1 };
    },
    async findStatistics(championshipId) {
      calls.push(["findStatistics", championshipId]);
      return { championshipId, teams: [], totalTeams: 0 };
    },
    async findTeams(championshipId) {
      calls.push(["findTeams", championshipId]);
      return { items: [{ registrationId: "insc-1" }], limit: 100, page: 1, total: 1 };
    },
    async findTopScorers(championshipId) {
      calls.push(["findTopScorers", championshipId]);
      return { items: [{ playerId: "player-1" }], limit: 20, total: 1 };
    },
  };
  const server = await listen(createTestApp({ publicService }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const list = await fetchJson(`${baseUrl}/?page=2&limit=1`);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.page, 2);

    const detail = await fetchJson(`${baseUrl}/camp-1`);
    assert.equal(detail.body.data.name, "Copa J12");

    const groups = await fetchJson(`${baseUrl}/camp-1/grupos`);
    assert.equal(groups.body.data.total, 1);

    const teams = await fetchJson(`${baseUrl}/camp-1/equipes`);
    assert.equal(teams.body.data.items[0].registrationId, "insc-1");

    const matches = await fetchJson(`${baseUrl}/camp-1/jogos`);
    assert.equal(matches.body.data.items[0].id, "jogo-1");

    const standings = await fetchJson(`${baseUrl}/camp-1/classificacao`);
    assert.equal(standings.body.data.items[0].registrationId, "insc-1");

    const bracket = await fetchJson(`${baseUrl}/camp-1/mata-mata`);
    assert.equal(bracket.body.data.id, "chave-1");

    const statistics = await fetchJson(`${baseUrl}/camp-1/estatisticas`);
    assert.equal(statistics.body.data.championshipId, "camp-1");

    const topScorers = await fetchJson(`${baseUrl}/camp-1/artilharia`);
    assert.equal(topScorers.body.data.items[0].playerId, "player-1");

    const writeAttempt = await fetchJson(`${baseUrl}/camp-1/estatisticas`, {
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    assert.equal(writeAttempt.status, 404);

    assert.deepEqual(
      calls.map((call) => call[0]),
      [
        "findAll",
        "findById",
        "findGroups",
        "findTeams",
        "findMatches",
        "findStandings",
        "findBracket",
        "findStatistics",
        "findTopScorers",
      ],
    );
  } finally {
    await closeServer(server);
  }
});

function createTestApp(options) {
  const app = express();
  app.use(express.json());
  app.use(createChampionshipPublicRouter({ publicService: options.publicService }));
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: "not found" });
  });
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({
      code: error.code || "ERROR",
      error: error.message,
      success: false,
    });
  });
  return app;
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
