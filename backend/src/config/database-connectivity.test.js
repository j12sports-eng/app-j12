const assert = require("node:assert/strict");
const test = require("node:test");
const { createDatabaseConnectivity } = require("./database-connectivity.js");

const silentLogger = { error() {} };
function dbError(code, errno) {
  return Object.assign(new Error("fixture-secret-must-not-be-logged"), { code, errno });
}
function connection(ping = async () => {}) {
  const value = {
    releases: 0,
    ping,
    release() {
      value.releases += 1;
    },
  };
  return value;
}

for (const [name, code, errno] of [
  ["host bloqueado", "ER_HOST_IS_BLOCKED", 1129],
  ["acesso negado", "ER_ACCESS_DENIED_ERROR", 1045],
  ["database inexistente", "ER_BAD_DB_ERROR", 1049],
]) {
  test(`${name} falha imediatamente sem retry nem backoff`, async () => {
    let attempts = 0;
    const delays = [];
    const expected = dbError(code, errno);
    const subject = createDatabaseConnectivity({
      pool: {
        async getConnection() {
          attempts += 1;
          throw expected;
        },
      },
      sleep: async (delay) => delays.push(delay),
      logger: silentLogger,
    });
    await assert.rejects(subject.testConnection(), (error) => error === expected);
    assert.equal(attempts, 1);
    assert.deepEqual(delays, []);
  });
}

test("erro transitorio respeita limite total e backoff exponencial", async () => {
  let attempts = 0;
  const delays = [];
  const subject = createDatabaseConnectivity({
    pool: {
      async getConnection() {
        attempts += 1;
        throw dbError("ECONNRESET");
      },
    },
    maxAttempts: 3,
    sleep: async (delay) => delays.push(delay),
    logger: silentLogger,
  });
  await assert.rejects(subject.testConnection(), { code: "ECONNRESET" });
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [1000, 2000]);
});

test("erro desconhecido nao recebe retry", async () => {
  let attempts = 0;
  const subject = createDatabaseConnectivity({
    pool: {
      async getConnection() {
        attempts += 1;
        throw dbError("ER_UNLISTED");
      },
    },
    logger: silentLogger,
  });
  await assert.rejects(subject.testConnection(), { code: "ER_UNLISTED" });
  assert.equal(attempts, 1);
});

test("sucesso retorna true e libera a conexao", async () => {
  const acquired = connection();
  const subject = createDatabaseConnectivity({
    pool: {
      async getConnection() {
        return acquired;
      },
    },
    logger: silentLogger,
  });
  assert.equal(await subject.testConnection(), true);
  assert.equal(acquired.releases, 1);
});

test("falha no ping libera a conexao adquirida", async () => {
  const acquired = connection(async () => {
    throw dbError("ER_BAD_DB_ERROR", 1049);
  });
  const subject = createDatabaseConnectivity({
    pool: {
      async getConnection() {
        return acquired;
      },
    },
    logger: silentLogger,
  });
  await assert.rejects(subject.testConnection(), { errno: 1049 });
  assert.equal(acquired.releases, 1);
});

test("single-flight compartilha a mesma cadeia concorrente", async () => {
  let attempts = 0;
  let resolvePing;
  const acquired = connection(
    () =>
      new Promise((resolve) => {
        resolvePing = resolve;
      }),
  );
  const subject = createDatabaseConnectivity({
    pool: {
      async getConnection() {
        attempts += 1;
        return acquired;
      },
    },
    logger: silentLogger,
  });
  const first = subject.testConnection();
  const second = subject.testConnection();
  assert.equal(first, second);
  await new Promise(setImmediate);
  resolvePing();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(attempts, 1);
});

test("keepalive fica desativado por default", () => {
  let schedules = 0;
  const subject = createDatabaseConnectivity({
    pool: {},
    setIntervalFn() {
      schedules += 1;
    },
    logger: silentLogger,
  });
  assert.equal(subject.startKeepalive(), null);
  assert.equal(schedules, 0);
});

test("keepalive habilitado aplica minimo e nao sobrepoe execucoes", async () => {
  let callback;
  let interval;
  let queries = 0;
  let resolveQuery;
  const subject = createDatabaseConnectivity({
    pool: {
      query() {
        queries += 1;
        return new Promise((resolve) => {
          resolveQuery = resolve;
        });
      },
    },
    setIntervalFn(fn, ms) {
      callback = fn;
      interval = ms;
      return { unref() {} };
    },
    logger: silentLogger,
  });
  subject.startKeepalive({ enabled: true, intervalMs: 1 });
  assert.equal(interval, 60000);
  const first = callback();
  await Promise.resolve();
  await callback();
  assert.equal(queries, 1);
  resolveQuery();
  await first;
});

test("logs de conectividade sao sanitizados", async () => {
  const entries = [];
  const subject = createDatabaseConnectivity({
    pool: {
      async getConnection() {
        throw dbError("ER_ACCESS_DENIED_ERROR", 1045);
      },
    },
    logger: {
      error(...args) {
        entries.push(args);
      },
    },
  });
  await assert.rejects(subject.testConnection());
  const serialized = JSON.stringify(entries);
  assert.doesNotMatch(serialized, /fixture-secret|password|token|jwt/i);
  assert.match(serialized, /ER_ACCESS_DENIED_ERROR/);
});
