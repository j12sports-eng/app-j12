const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ACTIVE_DRAFT_UNIQUE_INDEX_NAME,
  DRAFT_ENROLLMENT_LOCK_FAILED_CODE,
  DRAFT_ENROLLMENT_LOCK_TIMEOUT_CODE,
  ENROLLMENT_PROJECTION_SQL,
  GET_DRAFT_ENROLLMENT_LOCK_SQL,
  INSERT_ENROLLMENT_SQL,
  MySqlEnrollmentRepository,
  RELEASE_DRAFT_ENROLLMENT_LOCK_SQL,
  SELECT_ACTIVE_ENROLLMENT_BY_STUDENT_SQL,
  SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PERSON_SQL,
  SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PROFILE_SQL,
  SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL,
  SELECT_ENROLLMENT_BY_ID_SQL,
  buildDraftEnrollmentLockName,
  toEnrollmentDataFromRow,
} = require("./mysql-enrollment.repository.js");

const UNIT_ID = "12";
const OTHER_UNIT_ID = "13";
const MAX_BIGINT_ID = "9223372036854775807";

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

test("all Enrollment aggregate reads explicitly CAST unit_id AS CHAR", () => {
  const aggregateReads = [
    SELECT_ENROLLMENT_BY_ID_SQL,
    SELECT_ACTIVE_ENROLLMENT_BY_STUDENT_SQL,
    SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL,
    SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PERSON_SQL,
    SELECT_DRAFT_ENROLLMENT_BY_STUDENT_PROFILE_SQL,
  ];

  assert.match(ENROLLMENT_PROJECTION_SQL, /CAST\(unit_id AS CHAR\) AS unit_id/u);
  for (const sql of aggregateReads) {
    assert.match(sql, /CAST\(unit_id AS CHAR\) AS unit_id/u);
    assert.doesNotMatch(sql, /SELECT\s+\*/iu);
  }
});

test("mapper preserves BIGINT unitId as string and keeps legacy NULL", () => {
  assert.equal(toEnrollmentDataFromRow(row({ unit_id: MAX_BIGINT_ID })).unitId, MAX_BIGINT_ID);
  assert.equal(typeof toEnrollmentDataFromRow(row({ unit_id: MAX_BIGINT_ID })).unitId, "string");
  assert.equal(toEnrollmentDataFromRow(row({ unit_id: null })).unitId, null);

  const mapperSource = toEnrollmentDataFromRow.toString();
  assert.doesNotMatch(mapperSource, /\bNumber\s*\(/u);
  assert.doesNotMatch(mapperSource, /\bparseInt\s*\(/u);
  assert.doesNotMatch(mapperSource, /\bBigInt\s*\(/u);
});

test("create persists unit_id in the canonical INSERT parameter order", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      if (sql === INSERT_ENROLLMENT_SQL) return { affectedRows: 1 };
      return [row({ id: params[0], unit_id: UNIT_ID })];
    },
  });

  const result = await repository.create(enrollment());
  const insert = calls.find((call) => call.sql === INSERT_ENROLLMENT_SQL);

  assert.match(INSERT_ENROLLMENT_SQL, /student_profile_id,\s+unit_id,\s+responsible_person_id/u);
  assert.equal(insert.params[3], UNIT_ID);
  assert.equal(result.unitId, UNIT_ID);
});

test("findDraftByStudent requires and filters the exact unitId", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [row({ unit_id: UNIT_ID })];
    },
  });

  const result = await repository.findDraftByStudent(studentScope());

  assert.equal(result.unitId, UNIT_ID);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL);
  assert.deepEqual(calls[0].params, ["DRAFT", UNIT_ID, "person-1", "profile-1"]);
  assert.match(calls[0].sql, /AND unit_id = \?/u);
});

test("findDraftByStudent ignores cross-unit and legacy NULL drafts", async () => {
  for (const storedUnitId of [OTHER_UNIT_ID, null]) {
    let queryCount = 0;
    const repository = new MySqlEnrollmentRepository({
      queryRunner: async () => {
        queryCount += 1;
        return [row({ unit_id: storedUnitId })];
      },
    });

    assert.equal(await repository.findDraftByStudent(studentScope()), null);
    assert.equal(queryCount, 1);
  }

  let missingUnitQueries = 0;
  const repository = new MySqlEnrollmentRepository({
    queryRunner: async () => {
      missingUnitQueries += 1;
      return [];
    },
  });
  assert.equal(
    await repository.findDraftByStudent({
      studentPersonId: "person-1",
      studentProfileId: "profile-1",
    }),
    null,
  );
  assert.equal(missingUnitQueries, 0);
});

test("findActiveByStudent requires and filters the exact unitId", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [row({ status: "ACTIVE", unit_id: UNIT_ID })];
    },
  });

  const result = await repository.findActiveByStudent(studentScope());

  assert.equal(result.unitId, UNIT_ID);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, SELECT_ACTIVE_ENROLLMENT_BY_STUDENT_SQL);
  assert.deepEqual(calls[0].params, ["ACTIVE", UNIT_ID, "person-1", "profile-1"]);
  assert.match(calls[0].sql, /AND unit_id = \?/u);

  const crossUnitRepository = new MySqlEnrollmentRepository({
    queryRunner: async () => [row({ status: "ACTIVE", unit_id: OTHER_UNIT_ID })],
  });
  assert.equal(await crossUnitRepository.findActiveByStudent(studentScope()), null);
});

test("findById keeps its signature and returns unitId", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [row({ id: params[0], unit_id: MAX_BIGINT_ID })];
    },
  });

  const result = await repository.findById("draft-1");

  assert.equal(result.unitId, MAX_BIGINT_ID);
  assert.deepEqual(calls, [{ params: ["draft-1"], sql: SELECT_ENROLLMENT_BY_ID_SQL }]);
});

test("findById remains compatible with legacy rows whose unit_id is NULL", async () => {
  const repository = new MySqlEnrollmentRepository({
    queryRunner: async () => [row({ unit_id: null })],
  });

  const result = await repository.findById("legacy-draft");

  assert.equal(result.unitId, null);
});

test("draft named lock changes when only unitId changes", () => {
  const base = {
    student_person_id: "person-1",
    student_profile_id: "profile-1",
    unit_id: UNIT_ID,
  };
  const sameUnitLock = buildDraftEnrollmentLockName(base);

  assert.equal(buildDraftEnrollmentLockName({ ...base }), sameUnitLock);
  assert.notEqual(buildDraftEnrollmentLockName({ ...base, unit_id: OTHER_UNIT_ID }), sameUnitLock);
});

test("draft lock acquisition, operation and release use one dedicated connection", async () => {
  const fixture = connectionFixture();
  const repository = repositoryFor(fixture);
  const result = await repository.createDraftIfNotExists(enrollment());

  assert.equal(result.created, true);
  assert.equal(result.reused, false);
  assert.equal(result.enrollment.unitId, UNIT_ID);
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
  assert.equal(fixture.connection.calls[1].params[1], UNIT_ID);
  assert.equal(fixture.connection.calls[2].params[3], UNIT_ID);
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

test("concurrent attempts in one unit serialize and create one DRAFT", async () => {
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
  assert.equal(left.enrollment.unitId, UNIT_ID);
  assert.equal(
    manager.connections.every((connection) => connection.released),
    true,
  );
  for (const connection of manager.connections) {
    assert.equal(connection.calls[0].sql, GET_DRAFT_ENROLLMENT_LOCK_SQL);
    assert.equal(connection.calls.at(-1).sql, RELEASE_DRAFT_ENROLLMENT_LOCK_SQL);
  }
});

test("duplicate recovery reuses only a DRAFT from the same unit", async () => {
  const recovered = row({ id: "existing-draft", unit_id: UNIT_ID });
  const fixture = connectionFixture({
    draftSelectRecords: [null, recovered],
    insertError: activeDraftDuplicateError(),
  });
  const result = await repositoryFor(fixture).createDraftIfNotExists(enrollment());

  assert.deepEqual(
    { created: result.created, id: result.enrollment.id, reused: result.reused },
    { created: false, id: "existing-draft", reused: true },
  );
  const draftReads = fixture.connection.calls.filter(
    (call) => call.sql === SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL,
  );
  assert.equal(draftReads.length, 2);
  assert.equal(
    draftReads.every((call) => call.params[1] === UNIT_ID),
    true,
  );
});

test("duplicate recovery never reuses a DRAFT from another unit", async () => {
  const duplicateError = activeDraftDuplicateError();
  const fixture = connectionFixture({
    draftSelectRecords: [null, row({ id: "other-unit-draft", unit_id: OTHER_UNIT_ID })],
    insertError: duplicateError,
  });

  await assert.rejects(
    repositoryFor(fixture).createDraftIfNotExists(enrollment()),
    (error) => error === duplicateError,
  );
  assert.equal(fixture.connection.released, true);
});

test("duplicate recovery with legacy NULL unit_id fails closed", async () => {
  const duplicateError = activeDraftDuplicateError();
  const fixture = connectionFixture({
    draftSelectRecords: [null, row({ id: "legacy-draft", unit_id: null })],
    insertError: duplicateError,
  });

  await assert.rejects(
    repositoryFor(fixture).createDraftIfNotExists(enrollment()),
    (error) => error === duplicateError,
  );
  assert.equal(fixture.connection.released, true);
});

test("createDraftIfNotExists rejects missing unitId before acquiring a connection", async () => {
  let connectionRequests = 0;
  const repository = new MySqlEnrollmentRepository({
    connectionProvider: async () => {
      connectionRequests += 1;
      throw new Error("must not request a connection");
    },
    logger: silentLogger(),
    queryRunner: async () => [],
  });

  await assert.rejects(
    repository.createDraftIfNotExists(enrollment("missing-unit", { unitId: undefined })),
    /requires unitId/u,
  );
  assert.equal(connectionRequests, 0);
});

test("cancelActiveEnrollment updates conditionally from ACTIVE to CANCELLED", async () => {
  const calls = [];
  const repository = new MySqlEnrollmentRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return { affectedRows: 1 };
    },
  });

  const result = await repository.cancelActiveEnrollment({
    enrollmentId: "enrollment-cancel",
    expectedStatus: "ACTIVE",
    status: "CANCELLED",
  });

  assert.deepEqual(result, { changed: true });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /UPDATE enrollments/);
  assert.match(calls[0].sql, /SET status = \?/);
  assert.match(calls[0].sql, /WHERE id = \?/);
  assert.match(calls[0].sql, /AND status = \?/);
  assert.match(calls[0].sql, /AND deleted_at IS NULL/);
  assert.doesNotMatch(calls[0].sql, /\bDELETE\b/iu);
  assert.doesNotMatch(
    calls[0].sql,
    /cancelled_at|cancelled_by|cancel_reason|cancellation_reason/iu,
  );
  assert.deepEqual(calls[0].params, ["CANCELLED", "enrollment-cancel", "ACTIVE"]);
});

test("cancelActiveEnrollment reports unchanged when no row is updated", async () => {
  const repository = new MySqlEnrollmentRepository({
    queryRunner: async () => [{ affectedRows: 0 }, []],
  });

  const result = await repository.cancelActiveEnrollment({
    enrollmentId: "enrollment-cancel",
    expectedStatus: "ACTIVE",
    status: "CANCELLED",
  });

  assert.deepEqual(result, { changed: false });
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

function connectionFixture({
  draftSelectRecords = null,
  insertError = null,
  lockValue = 1,
  releaseValue = 1,
} = {}) {
  const state = { draftSelectIndex: 0, record: null };
  const connection = {
    calls: [],
    released: false,
    async execute(sql, params = []) {
      this.calls.push({ params, sql });
      if (sql === GET_DRAFT_ENROLLMENT_LOCK_SQL) return [[{ locked: lockValue }], []];
      if (sql === RELEASE_DRAFT_ENROLLMENT_LOCK_SQL) return [[{ released: releaseValue }], []];
      if (sql === SELECT_DRAFT_ENROLLMENT_BY_STUDENT_SQL) {
        const selected = draftSelectRecords
          ? draftSelectRecords[state.draftSelectIndex++]
          : state.record;
        return [selected ? [selected] : [], []];
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
          const record = manager.records.find(
            (candidate) =>
              candidate.unit_id === params[1] &&
              candidate.student_person_id === params[2] &&
              candidate.student_profile_id === params[3],
          );
          return [record ? [record] : [], []];
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
    created_at: params[10],
    deleted_at: params[12],
    end_date: params[9],
    id: params[0],
    responsible_person_id: params[4],
    responsible_profile_id: params[5],
    responsible_relationship_id: params[6],
    start_date: params[8],
    status: params[7],
    student_person_id: params[1],
    student_profile_id: params[2],
    unit_id: params[3],
    updated_at: params[11],
  };
}

function enrollment(id = "draft-1", overrides = {}) {
  return {
    id,
    startDate: "2026-07-20",
    status: "DRAFT",
    studentPersonId: "person-1",
    studentProfileId: "profile-1",
    unitId: UNIT_ID,
    ...overrides,
  };
}

function studentScope(overrides = {}) {
  return {
    studentPersonId: "person-1",
    studentProfileId: "profile-1",
    unitId: UNIT_ID,
    ...overrides,
  };
}

function row(overrides = {}) {
  return {
    confirmed_at: null,
    confirmed_by: null,
    created_at: "2026-07-20 10:00:00",
    deleted_at: null,
    end_date: null,
    id: "draft-1",
    responsible_person_id: null,
    responsible_profile_id: null,
    responsible_relationship_id: null,
    start_date: "2026-07-20",
    status: "DRAFT",
    student_person_id: "person-1",
    student_profile_id: "profile-1",
    unit_id: UNIT_ID,
    updated_at: "2026-07-20 10:00:00",
    ...overrides,
  };
}

function activeDraftDuplicateError() {
  const error = new Error(`Duplicate entry for key '${ACTIVE_DRAFT_UNIQUE_INDEX_NAME}'`);
  error.code = "ER_DUP_ENTRY";
  error.errno = 1062;
  return error;
}

function silentLogger() {
  return { error() {}, info() {}, warn() {} };
}
