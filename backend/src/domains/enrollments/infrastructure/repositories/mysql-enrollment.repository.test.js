const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DRAFT_ENROLLMENT_LOCK_FAILED_CODE,
  DRAFT_ENROLLMENT_LOCK_TIMEOUT_CODE,
  GET_DRAFT_ENROLLMENT_LOCK_SQL,
  INSERT_ENROLLMENT_SQL,
  MySqlEnrollmentRepository,
  RELEASE_DRAFT_ENROLLMENT_LOCK_SQL,
  SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL,
  SELECT_ENROLLMENT_BY_ID_SQL,
} = require("./mysql-enrollment.repository.js");

test("MySqlEnrollmentRepository embeds only a normalized search limit", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [];
    },
  });

  await repository.searchStudentScopes({ query: "Aluno Jornada", limit: 999 });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /LIMIT 25/);
  assert.doesNotMatch(calls[0].sql, /LIMIT \?/);
  assert.equal(calls[0].params.length, 8);
});

test("draft lock acquisition, operation and release use one dedicated connection", async () => {
  const fixture = connectionFixture();
  const repository = repositoryFor(fixture);
  const result = await repository.createDraftIfNotExists(enrollment());

  assert.equal(result.created, true);
  assert.equal(result.reused, false);
  assert.equal(fixture.connection.released, true);
  assert.deepEqual(
    fixture.connection.calls.map((call) => call.sql),
    [
      GET_DRAFT_ENROLLMENT_LOCK_SQL,
      SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL,
      INSERT_ENROLLMENT_SQL,
      SELECT_ENROLLMENT_BY_ID_SQL,
      RELEASE_DRAFT_ENROLLMENT_LOCK_SQL,
    ],
  );
});

test("operation failure still releases the named lock and dedicated connection", async () => {
  const fixture = connectionFixture({ insertError: new Error("controlled operation failure") });
  const repository = repositoryFor(fixture);

  await assert.rejects(repository.createDraftIfNotExists(enrollment()), /controlled operation/u);
  assert.equal(fixture.connection.released, true);
  assert.equal(
    fixture.connection.calls.some((call) => call.sql === RELEASE_DRAFT_ENROLLMENT_LOCK_SQL),
    true,
  );
});

test("non-successful RELEASE_LOCK fails safely after releasing the connection", async () => {
  const fixture = connectionFixture({ releaseValue: 0 });
  const repository = repositoryFor(fixture);
  await assert.rejects(
    repository.createDraftIfNotExists(enrollment()),
    (error) => error.code === "DRAFT_ENROLLMENT_LOCK_RELEASE_FAILED",
  );
  assert.equal(fixture.connection.released, true);
});

test("lock timeout and acquisition failure always release the connection", async () => {
  for (const [lockValue, code] of [
    [0, DRAFT_ENROLLMENT_LOCK_TIMEOUT_CODE],
    ["invalid", DRAFT_ENROLLMENT_LOCK_FAILED_CODE],
  ]) {
    const fixture = connectionFixture({ lockValue });
    const repository = repositoryFor(fixture);
    await assert.rejects(
      repository.createDraftIfNotExists(enrollment()),
      (error) => error.code === code,
    );
    assert.equal(fixture.connection.released, true);
    assert.equal(
      fixture.connection.calls.some((call) => call.sql === RELEASE_DRAFT_ENROLLMENT_LOCK_SQL),
      false,
    );
  }
});

test("concurrent attempts serialize on dedicated locks and create one DRAFT", async () => {
  const manager = concurrentConnectionManager();
  const repository = new MySqlEnrollmentRepository({
    connectionProvider: manager.getConnection,
    logger: silentLogger(),
    queryRunner: async () => {
      throw new Error("pool query runner must not execute inside the lock");
    },
  });
  const [left, right] = await Promise.all([
    repository.createDraftIfNotExists(enrollment("draft-left")),
    repository.createDraftIfNotExists(enrollment("draft-right")),
  ]);

  assert.equal(manager.records.length, 1);
  assert.deepEqual([left.created, right.created].sort(), [false, true]);
  assert.equal(left.enrollment.id, right.enrollment.id);
  assert.equal(
    manager.connections.every((connection) => connection.released),
    true,
  );
  for (const connection of manager.connections) {
    assert.equal(connection.calls[0].sql, GET_DRAFT_ENROLLMENT_LOCK_SQL);
    assert.equal(connection.calls.at(-1).sql, RELEASE_DRAFT_ENROLLMENT_LOCK_SQL);
  }
});

function repositoryFor(fixture) {
  return new MySqlEnrollmentRepository({
    connectionProvider: async () => fixture.connection,
    logger: silentLogger(),
    queryRunner: async () => {
      throw new Error("pool query runner must not execute inside the lock");
    },
  });
}

function connectionFixture({ insertError = null, lockValue = 1, releaseValue = 1 } = {}) {
  const state = { record: null };
  const connection = {
    calls: [],
    released: false,
    async execute(sql, params = []) {
      this.calls.push({ params, sql });
      if (sql === GET_DRAFT_ENROLLMENT_LOCK_SQL) return [[{ locked: lockValue }], []];
      if (sql === RELEASE_DRAFT_ENROLLMENT_LOCK_SQL) return [[{ released: releaseValue }], []];
      if (sql === SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL) {
        return [state.record ? [state.record] : [], []];
      }
      if (sql === INSERT_ENROLLMENT_SQL) {
        if (insertError) throw insertError;
        state.record = rowFromInsert(params);
        return [{ affectedRows: 1 }, []];
      }
      if (sql === SELECT_ENROLLMENT_BY_ID_SQL) return [state.record ? [state.record] : [], []];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {
      this.released = true;
    },
  };
  return { connection, state };
}

function concurrentConnectionManager() {
  const manager = {
    connections: [],
    lockOwner: null,
    records: [],
    waiters: [],
  };
  manager.getConnection = async () => {
    const id = `connection-${manager.connections.length + 1}`;
    const connection = {
      calls: [],
      id,
      released: false,
      async execute(sql, params = []) {
        this.calls.push({ params, sql });
        if (sql === GET_DRAFT_ENROLLMENT_LOCK_SQL) {
          if (!manager.lockOwner) {
            manager.lockOwner = id;
            return [[{ locked: 1 }], []];
          }
          await new Promise((resolve) => manager.waiters.push(resolve));
          manager.lockOwner = id;
          return [[{ locked: 1 }], []];
        }
        if (sql === RELEASE_DRAFT_ENROLLMENT_LOCK_SQL) {
          assert.equal(manager.lockOwner, id);
          manager.lockOwner = null;
          manager.waiters.shift()?.();
          return [[{ released: 1 }], []];
        }
        if (sql === SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL) {
          return [manager.records.length ? [manager.records[0]] : [], []];
        }
        if (sql === INSERT_ENROLLMENT_SQL) {
          manager.records.push(rowFromInsert(params));
          return [{ affectedRows: 1 }, []];
        }
        if (sql === SELECT_ENROLLMENT_BY_ID_SQL) {
          return [[manager.records.find((record) => record.id === params[0])].filter(Boolean), []];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
      release() {
        this.released = true;
      },
    };
    manager.connections.push(connection);
    return connection;
  };
  return manager;
}

function rowFromInsert(params) {
  return {
    created_at: params[6],
    deleted_at: params[8],
    end_date: params[5],
    id: params[0],
    start_date: params[4],
    status: params[3],
    student_person_id: params[1],
    student_profile_id: params[2],
    updated_at: params[7],
  };
}

function enrollment(id = "draft-1") {
  return {
    id,
    startDate: "2026-07-20",
    status: "DRAFT",
    studentPersonId: "person-1",
    studentProfileId: "profile-1",
  };
}

function silentLogger() {
  return { error() {}, info() {}, warn() {} };
}
