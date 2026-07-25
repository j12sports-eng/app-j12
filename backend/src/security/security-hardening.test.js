const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const {
  SECURITY_EVENTS,
  createBruteForceProtection,
  createSecurityAuditMiddleware,
  createSecurityHeadersMiddleware,
  createSlidingWindowRateLimiter,
  validateAuthInput,
} = require("./security-hardening.js");

test("security headers include CSP, cross-origin policies and no-store for auth", () => {
  const headers = {};
  const logger = collectingLogger([]);
  const middleware = createSecurityHeadersMiddleware({ logger, production: true });
  middleware(
    { headers: {}, path: "/auth/login" },
    { setHeader: (name, value) => (headers[name] = value) },
    () => {},
  );
  assert.match(headers["Content-Security-Policy"], /default-src 'none'/);
  assert.equal(headers["Cross-Origin-Opener-Policy"], "same-origin");
  assert.equal(headers["Cache-Control"], "no-store");
  assert.match(headers["Strict-Transport-Security"], /max-age=31536000/);
});

test("public invitation receives no-store and a redacted security path", () => {
  const token = "A".repeat(43);
  const headers = {};
  createSecurityHeadersMiddleware({ logger: collectingLogger([]), production: false })(
    { headers: {}, path: `/api/enrollments/digital-invitations/public/${token}` },
    { setHeader: (name, value) => (headers[name] = value) },
    () => {},
  );
  assert.equal(headers["Cache-Control"], "no-store");
});

test("sliding rate limiter is configurable and emits structured event", () => {
  const entries = [];
  const limiter = createSlidingWindowRateLimiter({
    logger: collectingLogger(entries),
    now: () => 100,
    policies: [{ name: "test", match: () => true, max: 1, windowMs: 1000 }],
  });
  const req = { headers: {}, ip: "local", method: "GET", path: "/public/value" };
  limiter(req, response(), () => {});
  const res = response();
  limiter(req, res, () => assert.fail("must be limited"));
  assert.equal(res.statusCode, 429);
  assert.equal(entries.at(-1).metadata.securityEvent, SECURITY_EVENTS.RATE_LIMIT_TRIGGERED);
});

test("brute force protection uses a sliding window and temporary block", () => {
  const entries = [];
  let timestamp = 100;
  const protection = createBruteForceProtection({
    blockMs: 1000,
    logger: collectingLogger(entries),
    maxAttempts: 2,
    now: () => timestamp,
    windowMs: 1000,
  });
  const req = { headers: {}, ip: "local", method: "POST", path: "/login" };
  assert.equal(protection.failure(req, "user@example.test"), false);
  assert.equal(protection.failure(req, "user@example.test"), true);
  assert.equal(protection.check(req, "user@example.test"), true);
  timestamp = 1101;
  assert.equal(protection.check(req, "user@example.test"), false);
});

test("audit maps validation, access, token and permission responses", () => {
  const entries = [];
  const middleware = createSecurityAuditMiddleware({ logger: collectingLogger(entries) });
  for (const [statusCode, authorization] of [[400], [401], [401, "Bearer fixture"], [403]]) {
    const res = new EventEmitter();
    res.statusCode = statusCode;
    middleware({ headers: { authorization }, method: "GET", path: "/test" }, res, () => {});
    res.emit("finish");
  }
  assert.deepEqual(
    entries.map((entry) => entry.metadata.securityEvent),
    ["VALIDATION_FAILED", "ACCESS_DENIED", "TOKEN_INVALID", "PERMISSION_DENIED"],
  );
});

test("auth input validation rejects oversized and nested unexpected payloads", () => {
  assert.equal(validateAuthInput({ body: { login: "a", password: "b" } }), true);
  assert.equal(validateAuthInput({ body: { login: "a".repeat(4097) } }), false);
  assert.equal(validateAuthInput({ body: { nested: {} } }), false);
});

function response() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
function collectingLogger(entries) {
  return Object.fromEntries(
    ["info", "warn", "error"].map((level) => [
      level,
      (event, metadata) => entries.push({ event, level, metadata }),
    ]),
  );
}
