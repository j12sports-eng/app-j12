const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");

const { observeAsyncOperation } = require("./async-observability.js");
const { runWithObservabilityContext } = require("./context.js");
const {
  createRequestObservabilityMiddleware,
  logHttpError,
  readId,
  sanitizeSensitivePath,
} = require("./http-observability.middleware.js");
const { createStructuredLogger } = require("./structured-logger.js");

test("structured logger emits JSON levels, context and redacts secrets", () => {
  const lines = [];
  const logger = createStructuredLogger({
    clock: () => new Date("2026-07-15T12:00:00.000Z"),
    consoleTarget: {
      error: (line) => lines.push(line),
      log: (line) => lines.push(line),
      warn() {},
    },
  });
  runWithObservabilityContext({ correlationId: "corr-1", requestId: "req-1" }, () =>
    logger.info("test.event", { password: "hidden", value: 1 }),
  );
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.level, "INFO");
  assert.equal(entry.correlationId, "corr-1");
  assert.equal(entry.password, "[REDACTED]");
});

test("request middleware propagates ids, duration, status and authenticated user", () => {
  const entries = [];
  const logger = collectingLogger(entries);
  const middleware = createRequestObservabilityMiddleware({
    createId: () => "generated",
    logger,
    now: sequence(100, 125),
  });
  const req = {
    headers: { "x-correlation-id": "corr-2", "x-request-id": "req-2" },
    method: "GET",
    originalUrl: "/api/test",
  };
  const res = new EventEmitter();
  res.statusCode = 200;
  res.setHeader = (name, value) => (res[name] = value);
  middleware(req, res, () => {
    req.user = { id: "user-1", role: "ADMIN", email: "private@example.com" };
  });
  res.emit("finish");
  assert.equal(res["X-Request-Id"], "req-2");
  assert.equal(res["X-Correlation-Id"], "corr-2");
  assert.equal(entries[1].metadata.durationMs, 25);
  assert.deepEqual(entries[1].metadata.user, { id: "user-1", role: "ADMIN" });
});

test("sensitive invitation paths redact only the path token", () => {
  const token = "A".repeat(43);
  assert.equal(
    sanitizeSensitivePath(`/api/enrollments/digital-invitations/public/${token}?source=email`),
    "/api/enrollments/digital-invitations/public/[REDACTED]?source=email",
  );
  assert.equal(sanitizeSensitivePath("/api/alunos/123"), "/api/alunos/123");

  const entries = [];
  const error = new Error(`failed at /api/enrollments/digital-invitations/public/${token}`);
  logHttpError(error, { method: "GET", originalUrl: `/api/enrollments/digital-invitations/public/${token}` }, { rawToken: token }, collectingLogger(entries));
  assert.equal(JSON.stringify(entries).includes(token), false);
});

test("request ids reject unsafe input and async operations log success and failure", async () => {
  assert.equal(readId("unsafe value"), null);
  const entries = [];
  const logger = collectingLogger(entries);
  assert.equal(await observeAsyncOperation("job", async () => 7, {}, logger), 7);
  await assert.rejects(
    observeAsyncOperation(
      "job",
      async () => {
        throw new Error("failed");
      },
      {},
      logger,
    ),
    /failed/,
  );
  assert.deepEqual(
    entries.map((entry) => entry.event),
    [
      "async.operation.started",
      "async.operation.completed",
      "async.operation.started",
      "async.operation.failed",
    ],
  );
});

function collectingLogger(entries) {
  return Object.fromEntries(
    ["info", "warn", "error"].map((level) => [
      level,
      (event, metadata) => entries.push({ event, level, metadata }),
    ]),
  );
}
function sequence(...values) {
  return () => values.shift();
}
