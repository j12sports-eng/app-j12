const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DigitalEnrollmentAdministrativeReview,
} = require("../../domain/entities/digital-enrollment-administrative-review.entity.js");
const {
  INSERT_COMMAND_SQL,
  INSERT_DECISION_SQL,
  INSERT_REVIEW_SQL,
  MySqlDigitalEnrollmentAdministrativeReviewRepository,
  SELECT_COMMAND_SQL,
  SELECT_DECISIONS_SQL,
  SELECT_REVIEW_BY_ENROLLMENT_SQL,
  SELECT_REVIEW_FOR_UPDATE_SQL,
  UPDATE_REVIEW_SQL,
  mapCommandRow,
  mapDecisionRow,
  mapReviewRow,
} = require("./mysql-digital-enrollment-administrative-review.repository.js");

const FINGERPRINT = "a".repeat(64);
const OTHER_FINGERPRINT = "b".repeat(64);

test("findByEnrollmentId returns null when no row exists", async () => {
  const { calls, repository } = fixture();

  assert.equal(await repository.findByEnrollmentId("enrollment-1"), null);
  assert.deepEqual(calls.queries, [
    { params: ["enrollment-1"], sql: SELECT_REVIEW_BY_ENROLLMENT_SQL },
  ]);
});

test("findByEnrollmentId reconstructs the real entity", async () => {
  const source = reviewRow();
  const { repository } = fixture({
    queryHandler: selectHandler([[source]]),
  });

  const result = await repository.findByEnrollmentId("enrollment-1");

  assert.equal(result instanceof DigitalEnrollmentAdministrativeReview, true);
  assert.equal(result.enrollmentId, "enrollment-1");
  assert.deepEqual(result.correctionItems, []);
  assert.equal(Object.isFrozen(result), true);
});

test("findCommandResult returns null or reconstructs an idempotent snapshot", async (t) => {
  await t.test("null", async () => {
    const { repository } = fixture();
    assert.equal(await repository.findCommandResult("command-1"), null);
  });

  await t.test("snapshot", async () => {
    const { repository } = fixture({
      queryHandler: selectHandler([[commandRow()]]),
    });
    const result = await repository.findCommandResult("command-1");
    assert.equal(result.fingerprint, FINGERPRINT);
    assert.equal(result.review instanceof DigitalEnrollmentAdministrativeReview, true);
    assert.equal(result.review.id, "review-1");
    assert.equal(Object.isFrozen(result), true);
  });
});

test("createPendingReview performs lookup, current read and both inserts in one transaction", async () => {
  const { calls, repository } = fixture();
  const source = review();

  const result = await repository.createPendingReview(createInput(source));

  assert.equal(result, source);
  assert.equal(calls.transactions, 1);
  assert.deepEqual(
    calls.queries.map(({ sql }) => sql),
    [SELECT_COMMAND_SQL, SELECT_REVIEW_BY_ENROLLMENT_SQL, INSERT_REVIEW_SQL, INSERT_COMMAND_SQL],
  );
  assert.equal(calls.queries[2].params[1], "enrollment-1");
  assert.equal(calls.queries[3].params[0], "command-1");
});

test("identical retry returns the previous snapshot without writes", async () => {
  const { calls, repository } = fixture({
    queryHandler: selectHandler([[commandRow()]]),
  });

  const result = await repository.createPendingReview(createInput());

  assert.equal(result.id, "review-1");
  assert.deepEqual(calls.queries.map(({ sql }) => sql), [SELECT_COMMAND_SQL]);
  assert.equal(calls.transactions, 1);
});

test("divergent retry raises the idempotency conflict", async () => {
  const { repository } = fixture({
    queryHandler: selectHandler([[commandRow()]]),
  });

  await assert.rejects(
    () =>
      repository.createPendingReview({
        ...createInput(),
        fingerprint: OTHER_FINGERPRINT,
      }),
    { code: "DIGITAL_ENROLLMENT_REVIEW_IDEMPOTENCY_CONFLICT" },
  );
});

test("an existing review raises a review conflict", async () => {
  let reads = 0;
  const { repository } = fixture({
    queryHandler(sql) {
      if (isSql(sql, SELECT_COMMAND_SQL)) return [];
      if (isSql(sql, SELECT_REVIEW_BY_ENROLLMENT_SQL) && reads++ === 0) {
        return [reviewRow()];
      }
      return [];
    },
  });

  await assert.rejects(() => repository.createPendingReview(createInput()), {
    code: "DIGITAL_ENROLLMENT_REVIEW_CONFLICT",
  });
});

test("update locks, updates the expected revision and inserts decision before command", async () => {
  const current = review();
  const next = decidedReview(current);
  const { calls, repository } = fixture({
    queryHandler(sql) {
      if (isSql(sql, SELECT_COMMAND_SQL)) return [];
      if (isSql(sql, SELECT_REVIEW_FOR_UPDATE_SQL)) return [reviewRow()];
      if (isSql(sql, UPDATE_REVIEW_SQL)) return { affectedRows: 1 };
      return { affectedRows: 1 };
    },
  });

  const result = await repository.updateIfRevisionMatches(
    updateInput(next, decision()),
  );

  assert.equal(result, next);
  assert.equal(calls.transactions, 1);
  assert.deepEqual(
    calls.queries.map(({ sql }) => sql),
    [
      SELECT_COMMAND_SQL,
      SELECT_REVIEW_FOR_UPDATE_SQL,
      UPDATE_REVIEW_SQL,
      INSERT_DECISION_SQL,
      INSERT_COMMAND_SQL,
    ],
  );
  assert.match(SELECT_REVIEW_FOR_UPDATE_SQL, /FOR UPDATE/);
  assert.equal(calls.queries[2].params.at(-1), 1);
});

test("affectedRows other than one raises a conflict and prevents history and command writes", async () => {
  const { calls, repository } = fixture({
    queryHandler(sql) {
      if (isSql(sql, SELECT_COMMAND_SQL)) return [];
      if (isSql(sql, SELECT_REVIEW_FOR_UPDATE_SQL)) return [reviewRow()];
      if (isSql(sql, UPDATE_REVIEW_SQL)) return { affectedRows: 0 };
      return { affectedRows: 1 };
    },
  });

  await assert.rejects(
    () => repository.updateIfRevisionMatches(updateInput(decidedReview(), decision())),
    { code: "DIGITAL_ENROLLMENT_REVIEW_CONFLICT" },
  );
  assert.equal(calls.queries.some(({ sql }) => isSql(sql, INSERT_DECISION_SQL)), false);
  assert.equal(calls.queries.some(({ sql }) => isSql(sql, INSERT_COMMAND_SQL)), false);
});

test("update without a decision writes no history and keeps command in the transaction", async () => {
  const { calls, repository } = fixture({
    queryHandler(sql) {
      if (isSql(sql, SELECT_COMMAND_SQL)) return [];
      if (isSql(sql, SELECT_REVIEW_FOR_UPDATE_SQL)) return [reviewRow()];
      return { affectedRows: 1 };
    },
  });

  await repository.updateIfRevisionMatches(updateInput(resubmittedReview()));

  assert.deepEqual(
    calls.queries.map(({ sql }) => sql),
    [SELECT_COMMAND_SQL, SELECT_REVIEW_FOR_UPDATE_SQL, UPDATE_REVIEW_SQL, INSERT_COMMAND_SQL],
  );
  assert.equal(calls.transactions, 1);
});

test("a decision insert failure prevents command insertion and propagates the error", async () => {
  const failure = new Error("decision insert failed");
  const { calls, repository } = fixture({
    queryHandler(sql) {
      if (isSql(sql, SELECT_COMMAND_SQL)) return [];
      if (isSql(sql, SELECT_REVIEW_FOR_UPDATE_SQL)) return [reviewRow()];
      if (isSql(sql, UPDATE_REVIEW_SQL)) return { affectedRows: 1 };
      if (isSql(sql, INSERT_DECISION_SQL)) throw failure;
      return { affectedRows: 1 };
    },
  });

  const received = await captureError(() =>
    repository.updateIfRevisionMatches(updateInput(decidedReview(), decision())),
  );

  assert.equal(received, failure);
  assert.equal(calls.queries.some(({ sql }) => isSql(sql, INSERT_COMMAND_SQL)), false);
});

test("a command insert failure is propagated", async () => {
  const failure = new Error("command insert failed");
  const { repository } = fixture({
    queryHandler(sql) {
      if (isSql(sql, SELECT_COMMAND_SQL)) return [];
      if (isSql(sql, SELECT_REVIEW_BY_ENROLLMENT_SQL)) return [];
      if (isSql(sql, INSERT_COMMAND_SQL)) throw failure;
      return { affectedRows: 1 };
    },
  });

  assert.equal(
    await captureError(() => repository.createPendingReview(createInput())),
    failure,
  );
});

test("ER_DUP_ENTRY resolves retry outside the transaction", async (t) => {
  await t.test("identical", async () => {
    const { calls, repository } = duplicateFixture(commandRow());
    const result = await repository.createPendingReview(createInput());
    assert.equal(result.id, "review-1");
    assert.equal(calls.transactions, 1);
    assert.equal(calls.outsideQueries, 1);
  });

  await t.test("divergent", async () => {
    const { repository } = duplicateFixture(
      commandRow({ fingerprint: OTHER_FINGERPRINT }),
    );
    await assert.rejects(() => repository.createPendingReview(createInput()), {
      code: "DIGITAL_ENROLLMENT_REVIEW_IDEMPOTENCY_CONFLICT",
    });
  });

  await t.test("without command", async () => {
    const { repository } = duplicateFixture(null);
    await assert.rejects(() => repository.createPendingReview(createInput()), {
      code: "DIGITAL_ENROLLMENT_REVIEW_CONFLICT",
    });
  });
});

test("mappers fail closed for invalid JSON, snapshots and dates", async (t) => {
  await t.test("review JSON", () => {
    assert.throws(() => mapReviewRow(reviewRow({ correction_items_json: "{" })), {
      code: "DIGITAL_ENROLLMENT_REVIEW_PERSISTENCE_FAILED",
    });
  });
  await t.test("command snapshot", () => {
    assert.throws(
      () => mapCommandRow(commandRow({ result_snapshot_json: "[]" })),
      { code: "DIGITAL_ENROLLMENT_REVIEW_PERSISTENCE_FAILED" },
    );
  });
  await t.test("review date", () => {
    assert.throws(() => mapReviewRow(reviewRow({ submitted_at: "invalid" })), {
      code: "DIGITAL_ENROLLMENT_REVIEW_PERSISTENCE_FAILED",
    });
  });
});

test("mapDecisionRow returns an immutable, explicitly projected object", () => {
  const result = mapDecisionRow(decisionRow());

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.correctionItems), true);
  assert.deepEqual(result.correctionItems, ["DOCUMENTS"]);
  assert.equal("unexpected" in result, false);
});

test("invalid fingerprints are rejected before a transaction starts", async () => {
  const { calls, repository } = fixture();
  await assert.rejects(
    () =>
      repository.createPendingReview({
        ...createInput(),
        fingerprint: "invalid",
      }),
    TypeError,
  );
  assert.equal(calls.transactions, 0);
});

test("empty and oversized identifiers are rejected", async (t) => {
  for (const value of ["", "x".repeat(65)]) {
    await t.test(String(value.length), async () => {
      const { repository } = fixture();
      await assert.rejects(() => repository.findByEnrollmentId(value), TypeError);
      await assert.rejects(() => repository.findCommandResult(value), TypeError);
      await assert.rejects(() => repository.listDecisionsByReviewId(value), TypeError);
    });
  }
});

test("write SQL is parameterized and never interpolates command values", async () => {
  const sensitiveCommandId = "command-user-value";
  const sensitiveEnrollmentId = "enrollment-user-value";
  const source = review({ enrollmentId: sensitiveEnrollmentId });
  const { calls, repository } = fixture();

  await repository.createPendingReview({
    commandId: sensitiveCommandId,
    fingerprint: FINGERPRINT,
    review: source,
  });

  for (const { sql } of calls.queries) {
    assert.equal(sql.includes(sensitiveCommandId), false);
    assert.equal(sql.includes(sensitiveEnrollmentId), false);
  }
  assert.match(INSERT_REVIEW_SQL, /VALUES\s*\(\?, \?, \?/);
  assert.match(INSERT_COMMAND_SQL, /VALUES\s*\(\?, \?, \?/);
  assert.equal((INSERT_REVIEW_SQL.match(/\?/g) || []).length, 14);
  assert.equal((INSERT_COMMAND_SQL.match(/\?/g) || []).length, 9);
});

test("listDecisionsByReviewId preserves returned order", async () => {
  const rows = [
    decisionRow({ command_id: "command-1", id: "decision-1" }),
    decisionRow({ command_id: "command-2", id: "decision-2" }),
  ];
  const { calls, repository } = fixture({
    queryHandler: selectHandler([rows]),
  });

  const result = await repository.listDecisionsByReviewId("review-1");

  assert.deepEqual(result.map(({ id }) => id), ["decision-1", "decision-2"]);
  assert.deepEqual(calls.queries[0], {
    params: ["review-1"],
    sql: SELECT_DECISIONS_SQL,
  });
});

test("isolated appendDecision is prohibited", async () => {
  const { calls, repository } = fixture();
  await assert.rejects(() => repository.appendDecision(decision()), {
    message: "Decisions must be appended atomically through updateIfRevisionMatches.",
  });
  assert.equal(calls.transactions, 0);
  assert.equal(calls.queries.length, 0);
});

test("each create and update operation calls transactionRunner exactly once", async () => {
  const created = fixture();
  await created.repository.createPendingReview(createInput());
  assert.equal(created.calls.transactions, 1);

  const updated = fixture({
    queryHandler(sql) {
      if (isSql(sql, SELECT_COMMAND_SQL)) return [];
      if (isSql(sql, SELECT_REVIEW_FOR_UPDATE_SQL)) return [reviewRow()];
      return { affectedRows: 1 };
    },
  });
  await updated.repository.updateIfRevisionMatches(updateInput(resubmittedReview()));
  assert.equal(updated.calls.transactions, 1);
});

function fixture({ queryHandler = () => [], idGenerator = () => "decision-1" } = {}) {
  const calls = { queries: [], transactions: 0 };
  const queryRunner = async (sql, params = []) => {
    calls.queries.push({ params, sql });
    return queryHandler(sql, params);
  };
  const transactionRunner = async (work) => {
    calls.transactions += 1;
    return work(queryRunner);
  };
  const repository = new MySqlDigitalEnrollmentAdministrativeReviewRepository({
    idGenerator,
    queryRunner,
    transactionRunner,
  });
  return { calls, repository };
}

function duplicateFixture(previousCommand) {
  const calls = { outsideQueries: 0, transactions: 0 };
  const duplicate = Object.assign(new Error("duplicate"), {
    code: "ER_DUP_ENTRY",
    errno: 1062,
  });
  const queryRunner = async (sql) => {
    calls.outsideQueries += 1;
    if (isSql(sql, SELECT_COMMAND_SQL)) {
      return previousCommand ? [previousCommand] : [];
    }
    return [];
  };
  const transactionRunner = async () => {
    calls.transactions += 1;
    throw duplicate;
  };
  return {
    calls,
    repository: new MySqlDigitalEnrollmentAdministrativeReviewRepository({
      idGenerator: () => "decision-1",
      queryRunner,
      transactionRunner,
    }),
  };
}

function review(overrides = {}) {
  return new DigitalEnrollmentAdministrativeReview({
    correctionItems: [],
    createdAt: "2026-07-27T12:00:00.000Z",
    decidedAt: null,
    decisionCode: null,
    decisionReason: null,
    enrollmentId: "enrollment-1",
    id: "review-1",
    responsibleRelationshipId: "relationship-1",
    reviewerAuthIdentityId: null,
    reviewRound: 1,
    revision: 1,
    status: "PENDING_REVIEW",
    submittedAt: "2026-07-27T12:00:00.000Z",
    updatedAt: "2026-07-27T12:00:00.000Z",
    ...overrides,
  });
}

function decidedReview(source = review()) {
  return source.decide({
    decisionCode: "APPROVED",
    decisionReason: null,
    now: "2026-07-27T13:00:00.000Z",
    reviewerAuthIdentityId: "reviewer-1",
    status: "APPROVED",
  });
}

function resubmittedReview() {
  return review({
    reviewRound: 2,
    revision: 2,
    submittedAt: "2026-07-27T13:00:00.000Z",
    updatedAt: "2026-07-27T13:00:00.000Z",
  });
}

function createInput(source = review()) {
  return {
    commandId: "command-1",
    fingerprint: FINGERPRINT,
    review: source,
  };
}

function updateInput(source, sourceDecision = null) {
  return {
    commandId: "command-2",
    decision: sourceDecision,
    expectedRevision: 1,
    fingerprint: FINGERPRINT,
    review: source,
  };
}

function decision(overrides = {}) {
  return Object.freeze({
    commandId: "command-2",
    decidedAt: "2026-07-27T13:00:00.000Z",
    decisionCode: "APPROVED",
    decisionReason: null,
    reviewId: "review-1",
    reviewerAuthIdentityId: "reviewer-1",
    reviewRound: 1,
    status: "APPROVED",
    ...overrides,
  });
}

function reviewRow(overrides = {}) {
  return {
    correction_items_json: "[]",
    created_at: "2026-07-27 12:00:00.000",
    decided_at: null,
    decision_code: null,
    decision_reason: null,
    enrollment_id: "enrollment-1",
    id: "review-1",
    responsible_relationship_id: "relationship-1",
    reviewer_auth_identity_id: null,
    review_round: 1,
    revision: 1,
    status: "PENDING_REVIEW",
    submitted_at: "2026-07-27 12:00:00.000",
    updated_at: "2026-07-27 12:00:00.000",
    ...overrides,
  };
}

function commandRow(overrides = {}) {
  const source = review();
  return {
    command_id: "command-1",
    fingerprint: FINGERPRINT,
    result_snapshot_json: JSON.stringify({
      correctionItems: [...source.correctionItems],
      createdAt: source.createdAt,
      decidedAt: source.decidedAt,
      decisionCode: source.decisionCode,
      decisionReason: source.decisionReason,
      enrollmentId: source.enrollmentId,
      id: source.id,
      responsibleRelationshipId: source.responsibleRelationshipId,
      reviewerAuthIdentityId: source.reviewerAuthIdentityId,
      reviewRound: source.reviewRound,
      revision: source.revision,
      status: source.status,
      submittedAt: source.submittedAt,
      updatedAt: source.updatedAt,
    }),
    ...overrides,
  };
}

function decisionRow(overrides = {}) {
  return {
    command_id: "command-1",
    correction_items_json: "[\"DOCUMENTS\"]",
    created_at: "2026-07-27 13:00:00.000",
    decided_at: "2026-07-27 13:00:00.000",
    decision_code: "DOCUMENT_CORRECTION",
    decision_reason: null,
    enrollment_id: "enrollment-1",
    id: "decision-1",
    review_id: "review-1",
    reviewer_auth_identity_id: "reviewer-1",
    review_round: 1,
    status: "CORRECTION_REQUESTED",
    unexpected: "not-projected",
    ...overrides,
  };
}

function selectHandler(results) {
  let index = 0;
  return () => results[index++] ?? [];
}

function isSql(actual, expected) {
  return actual.trim() === expected.trim();
}

async function captureError(work) {
  try {
    await work();
  } catch (error) {
    return error;
  }
  assert.fail("Expected work to reject.");
}
