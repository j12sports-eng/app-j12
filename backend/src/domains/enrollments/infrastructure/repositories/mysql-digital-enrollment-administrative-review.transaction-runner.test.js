const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createMySqlDigitalEnrollmentAdministrativeReviewTransactionRunner,
} = require("./mysql-digital-enrollment-administrative-review.transaction-runner.js");

test("rejects missing work before acquiring a connection", async () => {
  let connectionRequests = 0;
  const runner = createRunner({
    connectionProvider: async () => {
      connectionRequests += 1;
      return fakeConnection();
    },
  });

  await assert.rejects(() => runner(), {
    message: "Administrative review transaction work must be a function.",
  });
  assert.equal(connectionRequests, 0);
});

test("rejects an invalid connectionProvider", () => {
  assert.throws(
    () =>
      createMySqlDigitalEnrollmentAdministrativeReviewTransactionRunner({
        connectionProvider: "invalid",
      }),
    {
      message: "Administrative review transaction connection provider is required.",
    },
  );
});

test("rejects connections missing each required method", async (t) => {
  for (const method of ["beginTransaction", "commit", "execute", "release", "rollback"]) {
    await t.test(method, async () => {
      const connection = fakeConnection();
      delete connection[method];
      const runner = createRunner({
        connectionProvider: async () => connection,
      });

      await assert.rejects(() => runner(async () => "unused"), {
        message: `MySQL administrative review connection requires ${method}().`,
      });
    });
  }
});

test("begins before work, provides queryRunner, executes parameters, commits and returns result", async () => {
  const events = [];
  const connection = fakeConnection({ events });
  const runner = createRunner({
    connectionProvider: async () => connection,
  });

  const result = await runner(async (queryRunner) => {
  events.push("work");
  assert.equal(typeof queryRunner, "function");

  const rows = await queryRunner("SELECT ? AS value", [42]);

  assert.deepEqual(rows, [{ value: 42 }]);
  return "result";
});

  assert.equal(result, "result");
  assert.deepEqual(events, [
    "beginTransaction",
    "work",
    ["execute", "SELECT ? AS value", [42]],
    "commit",
    "release",
  ]);
  assert.equal(events.includes("rollback"), false);
});

test("rolls back callback failures, preserves the original error and always releases", async () => {
  const events = [];
  const originalError = new Error("work failed");
  const runner = createRunner({
    connectionProvider: async () => fakeConnection({ events }),
  });

  const received = await captureError(() =>
    runner(async () => {
      events.push("work");
      throw originalError;
    }),
  );

  assert.equal(received, originalError);
  assert.deepEqual(events, ["beginTransaction", "work", "rollback", "release"]);
});

test("attaches rollbackError without replacing the original error", async () => {
  const originalError = new Error("work failed");
  const rollbackError = new Error("rollback failed");
  const runner = createRunner({
    connectionProvider: async () => fakeConnection({ rollbackError }),
  });

  const received = await captureError(() =>
    runner(async () => {
      throw originalError;
    }),
  );

  assert.equal(received, originalError);
  assert.equal(received.rollbackError, rollbackError);
});

test("propagates a release error after a successful callback", async () => {
  const releaseError = new Error("release failed");
  const runner = createRunner({
    connectionProvider: async () => fakeConnection({ releaseError }),
  });

  const received = await captureError(() => runner(async () => "result"));

  assert.equal(received, releaseError);
});

test("attaches releaseError without replacing a primary callback error", async () => {
  const originalError = new Error("work failed");
  const releaseError = new Error("release failed");
  const runner = createRunner({
    connectionProvider: async () => fakeConnection({ releaseError }),
  });

  const received = await captureError(() =>
    runner(async () => {
      throw originalError;
    }),
  );

  assert.equal(received, originalError);
  assert.equal(received.releaseError, releaseError);
});

test("does not instantiate a repository or open a nested transaction", async () => {
  let beginCalls = 0;

  const connection = fakeConnection({
    onBegin() {
      beginCalls += 1;
    },
  });

  const runner = createRunner({
    connectionProvider: async () => connection,
  });

  await runner(async (queryRunner) => {
    await queryRunner("SELECT 1", []);
  });

  assert.equal(beginCalls, 1);
});

function createRunner(options) {
  return createMySqlDigitalEnrollmentAdministrativeReviewTransactionRunner(options);
}

function fakeConnection({
  events = [],
  onBegin = null,
  releaseError = null,
  rollbackError = null,
} = {}) {
  return {
    async beginTransaction() {
      events.push("beginTransaction");
      onBegin?.();
    },
    async commit() {
      events.push("commit");
    },
    async execute(sql, params) {
      events.push(["execute", sql, params]);
      return [[{ value: params[0] }], []];
    },
    async release() {
      events.push("release");
      if (releaseError) throw releaseError;
    },
    async rollback() {
      events.push("rollback");
      if (rollbackError) throw rollbackError;
    },
  };
}

async function captureError(work) {
  try {
    await work();
  } catch (error) {
    return error;
  }
  assert.fail("Expected work to reject.");
}
