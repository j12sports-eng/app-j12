const assert = require("node:assert/strict");
const http = require("node:http");
const { test } = require("node:test");

const express = require("express");

const { createCourtRentalRouter } = require("../routes/court-rental.routes.js");

test("court rental router lists courts and delegates reservation creation", async () => {
  const calls = [];
  const service = {
    async createReservation(payload) {
      calls.push(["createReservation", payload]);
      return {
        created: [{ id: "reserva-1", title: payload.title }],
        summary: { createdCount: 1, waitlistedCount: 0 },
        waitlisted: [],
      };
    },
    async listCourts(filters) {
      calls.push(["listCourts", filters.status]);
      return [{ id: "quadra-1", nome: "Quadra Principal", status: filters.status || "ativa" }];
    },
  };
  const server = await listen(
    createTestApp({
      service,
    }),
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const courts = await fetchJson(`${baseUrl}/?status=ativa`);
    assert.equal(courts.status, 200);
    assert.equal(courts.body.success, true);
    assert.equal(courts.body.data[0].id, "quadra-1");

    const created = await fetchJson(`${baseUrl}/reservas`, {
      body: JSON.stringify({
        courtId: "quadra-1",
        endAt: "2026-07-06T20:00:00",
        renterId: "loc-1",
        startAt: "2026-07-06T19:00:00",
        title: "Locacao teste",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.success, true);
    assert.equal(created.body.data.created[0].id, "reserva-1");
    assert.deepEqual(calls[1], [
      "createReservation",
      {
        courtId: "quadra-1",
        endAt: "2026-07-06T20:00:00",
        renterId: "loc-1",
        startAt: "2026-07-06T19:00:00",
        title: "Locacao teste",
      },
    ]);
  } finally {
    await closeServer(server);
  }
});

test("court rental router keeps administrative access protected", async () => {
  const server = await listen(
    createTestApp({
      accessMiddleware: (_req, res) => res.status(403).json({ success: false, error: "bloqueado" }),
      service: {
        async listCourts() {
          return [];
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

test("court rental router exposes Sprint 16 operational actions", async () => {
  const calls = [];
  const service = {
    async addToWaitlist(payload) {
      calls.push(["addToWaitlist", payload.renterId]);
      return { id: "wait-novo", status: "waiting" };
    },
    async cancelBlock(blockId, payload) {
      calls.push(["cancelBlock", blockId, payload.reason]);
      return { active: false, id: blockId };
    },
    async confirmReservationPayment(reservationId, payload) {
      calls.push(["confirmReservationPayment", reservationId, payload.paymentMethod]);
      return { id: reservationId, paymentStatus: "paid" };
    },
    async duplicateReservation(reservationId, payload) {
      calls.push(["duplicateReservation", reservationId, payload.title]);
      return { id: "reserva-duplicada", source: reservationId };
    },
    async exportReports(filters) {
      calls.push(["exportReports", filters.format]);
      return {
        contentBase64: "UmVsYXRvcmlv",
        filename: "relatorio.csv",
        format: filters.format,
        mimeType: "text/csv",
      };
    },
    async promoteWaitlistEntry(waitlistId) {
      calls.push(["promoteWaitlistEntry", waitlistId]);
      return { waitlist: { id: waitlistId, status: "promoted" } };
    },
    async updateBlock(blockId, payload) {
      calls.push(["updateBlock", blockId, payload.type]);
      return { id: blockId, type: payload.type };
    },
  };
  const server = await listen(createTestApp({ service }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const paid = await fetchJson(`${baseUrl}/reservas/res-1/pagamento`, {
      body: JSON.stringify({ paymentMethod: "pix" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const duplicated = await fetchJson(`${baseUrl}/reservas/res-1/duplicar`, {
      body: JSON.stringify({ title: "Copia" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const updatedBlock = await fetchJson(`${baseUrl}/bloqueios/bloq-1`, {
      body: JSON.stringify({ type: "evento" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const cancelledBlock = await fetchJson(`${baseUrl}/bloqueios/bloq-1?reason=ok`, {
      method: "DELETE",
    });
    const promoted = await fetchJson(`${baseUrl}/lista-espera/wait-1/promover`, {
      method: "POST",
    });
    const waitlisted = await fetchJson(`${baseUrl}/lista-espera`, {
      body: JSON.stringify({
        courtId: "quadra-1",
        desiredEndAt: "2026-07-06T20:00:00",
        desiredStartAt: "2026-07-06T19:00:00",
        renterId: "loc-1",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const exported = await fetchJson(`${baseUrl}/relatorios/exportar?format=csv`);

    assert.equal(paid.status, 200);
    assert.equal(duplicated.status, 201);
    assert.equal(updatedBlock.body.data.type, "evento");
    assert.equal(cancelledBlock.body.data.active, false);
    assert.equal(promoted.body.data.waitlist.status, "promoted");
    assert.equal(waitlisted.status, 201);
    assert.equal(waitlisted.body.data.id, "wait-novo");
    assert.equal(exported.body.data.filename, "relatorio.csv");
    assert.deepEqual(calls, [
      ["confirmReservationPayment", "res-1", "pix"],
      ["duplicateReservation", "res-1", "Copia"],
      ["updateBlock", "bloq-1", "evento"],
      ["cancelBlock", "bloq-1", "ok"],
      ["promoteWaitlistEntry", "wait-1"],
      ["addToWaitlist", "loc-1"],
      ["exportReports", "csv"],
    ]);
  } finally {
    await closeServer(server);
  }
});

function createTestApp(options) {
  const app = express();
  app.use(express.json());
  app.use(
    createCourtRentalRouter({
      accessMiddleware: options.accessMiddleware || ((_req, _res, next) => next()),
      authMiddleware: (req, _res, next) => {
        req.auth = { email: "admin@j12.test", role: "admin" };
        next();
      },
      service: options.service,
    }),
  );
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
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
