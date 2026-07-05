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
  assert.equal(ensureChampionshipAdminAccess.accessPolicy.currentGuard, "requireAuth+canManageSystem");
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
      championshipService: options.service,
      registrationService: options.registrationService,
    }),
  );
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  });
  return app;
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
