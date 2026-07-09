const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ENROLLMENT_OBLIGATION_UNIQUE_INDEX,
  MySqlEnrollmentFinancialObligationRepository,
} = require("./mysql-enrollment-financial-obligation.repository.js");

test("MySqlEnrollmentFinancialObligationRepository creates and maps an obligation record", async () => {
  const calls = [];
  const rows = new Map();
  const queryRunner = async (sql, params = []) => {
    calls.push({ params, sql });

    if (sql.includes("INSERT INTO")) {
      const [
        id,
        enrollmentId,
        obligationType,
        status,
        amount,
        currency,
        planId,
        dueDate,
        source,
        createdBy,
        metadataJson,
      ] = params;
      rows.set(id, {
        amount,
        cancelled_at: null,
        cancelled_by: null,
        created_at: "2026-07-02 10:00:00",
        created_by: createdBy,
        currency,
        due_date: dueDate,
        enrollment_id: enrollmentId,
        id,
        metadata_json: metadataJson,
        obligation_type: obligationType,
        plan_id: planId,
        source,
        status,
        updated_at: "2026-07-02 10:00:00",
      });
      return { affectedRows: 1 };
    }

    assert.match(sql, /SELECT \*/);
    return [rows.get(params[0])].filter(Boolean);
  };

  const repository = new MySqlEnrollmentFinancialObligationRepository({ queryRunner });
  const result = await repository.createEnrollmentFinancialObligationRecord({
    amount: "250.456",
    createdBy: "admin@j12.local",
    currency: "brl",
    dueDate: "2026-07-10",
    enrollmentId: "enrollment-fin-1",
    id: "obligation-1",
    metadata: { source: "unit-test" },
    obligationType: "INITIAL_ENROLLMENT_OBLIGATION",
    planId: "plan-1",
    source: "ENROLLMENT",
    status: "PREPARED",
  });

  assert.equal(result.created, true);
  assert.equal(result.reused, false);
  assert.deepEqual(result.obligation, {
    amount: 250.46,
    cancelledAt: null,
    cancelledBy: null,
    createdAt: "2026-07-02 10:00:00",
    createdBy: "admin@j12.local",
    currency: "BRL",
    dueDate: "2026-07-10",
    enrollmentId: "enrollment-fin-1",
    id: "obligation-1",
    metadata: { source: "unit-test" },
    obligationType: "INITIAL_ENROLLMENT_OBLIGATION",
    planId: "plan-1",
    source: "ENROLLMENT",
    status: "PREPARED",
    updatedAt: "2026-07-02 10:00:00",
  });
  assert.equal(
    calls.some((call) =>
      /j12_mensalidades|j12_financeiro_cobrancas|j12_pagamentos|financial_payments/i.test(call.sql),
    ),
    false,
  );
});

test("MySqlEnrollmentFinancialObligationRepository reuses existing record on duplicate unique key", async () => {
  const existingObligation = {
    amount: null,
    cancelled_at: null,
    cancelled_by: null,
    created_at: "2026-07-02 10:00:00",
    created_by: "admin@j12.local",
    currency: null,
    due_date: null,
    enrollment_id: "enrollment-fin-2",
    id: "obligation-existing",
    metadata_json: null,
    obligation_type: "INITIAL_ENROLLMENT_OBLIGATION",
    plan_id: null,
    source: "ENROLLMENT",
    status: "PREPARED",
    updated_at: "2026-07-02 10:00:00",
  };
  let insertAttempted = false;
  const queryRunner = async (sql, params = []) => {
    if (sql.includes("INSERT INTO")) {
      insertAttempted = true;
      const error = new Error(`Duplicate entry for key '${ENROLLMENT_OBLIGATION_UNIQUE_INDEX}'`);
      error.code = "ER_DUP_ENTRY";
      error.errno = 1062;
      throw error;
    }

    assert.match(sql, /WHERE enrollment_id = \?/);
    assert.deepEqual(params, ["enrollment-fin-2", "INITIAL_ENROLLMENT_OBLIGATION"]);
    return [existingObligation];
  };

  const repository = new MySqlEnrollmentFinancialObligationRepository({ queryRunner });
  const result = await repository.createEnrollmentFinancialObligationRecord({
    createdBy: "admin@j12.local",
    enrollmentId: "enrollment-fin-2",
    obligationType: "INITIAL_ENROLLMENT_OBLIGATION",
    status: "PREPARED",
  });

  assert.equal(insertAttempted, true);
  assert.equal(result.created, false);
  assert.equal(result.reused, true);
  assert.equal(result.obligation.id, "obligation-existing");
});

test("MySqlEnrollmentFinancialObligationRepository updates obligation status with audit metadata", async () => {
  const calls = [];
  const row = {
    amount: "250.00",
    cancelled_at: null,
    cancelled_by: null,
    created_at: "2026-07-02 10:00:00",
    created_by: "admin@j12.local",
    currency: "BRL",
    due_date: "2026-07-10",
    enrollment_id: "enrollment-status-repo",
    id: "obligation-status-repo",
    metadata_json: JSON.stringify({ source: "unit-test" }),
    obligation_type: "INITIAL_ENROLLMENT_OBLIGATION",
    plan_id: "plan-status",
    source: "ENROLLMENT",
    status: "PENDING",
    updated_at: "2026-07-02 10:00:00",
  };
  const queryRunner = async (sql, params = []) => {
    calls.push({ params, sql });

    if (/j12_mensalidades|j12_financeiro_cobrancas|j12_pagamentos|financial_payments/i.test(sql)) {
      throw new Error(`Unexpected legacy financial write in status test: ${sql}`);
    }

    if (sql.includes("UPDATE")) {
      assert.equal(params[0], "CANCELLED");
      assert.equal(params[1], "2026-07-21 09:00:00");
      assert.equal(params[2], "admin@j12.local");
      assert.equal(params[4], "obligation-status-repo");
      assert.deepEqual(params.slice(5), ["PENDING", "OVERDUE"]);

      row.status = params[0];
      row.cancelled_at = params[1];
      row.cancelled_by = params[2];
      row.metadata_json = params[3];
      row.updated_at = "2026-07-21 09:00:01";
      return { affectedRows: 1 };
    }

    assert.match(sql, /WHERE id = \?/);
    return [row];
  };
  const repository = new MySqlEnrollmentFinancialObligationRepository({ queryRunner });

  const result = await repository.updateEnrollmentFinancialObligationStatus({
    cancelledAt: "2026-07-21 09:00:00",
    cancelledBy: "admin@j12.local",
    currentStatuses: ["PENDING", "OVERDUE"],
    metadata: {
      statusAudit: [
        {
          action: "CANCEL",
          reason: "unit-test",
        },
      ],
    },
    obligationId: "obligation-status-repo",
    status: "CANCELLED",
  });

  assert.equal(result.updated, true);
  assert.equal(result.obligation.status, "CANCELLED");
  assert.equal(result.obligation.cancelledAt, "2026-07-21 09:00:00");
  assert.equal(result.obligation.cancelledBy, "admin@j12.local");
  assert.equal(result.obligation.metadata.statusAudit[0].action, "CANCEL");
  assert.equal(
    calls.some((call) => call.sql.includes("UPDATE")),
    true,
  );
});

test("MySqlEnrollmentFinancialObligationRepository lists admin obligations by enrollment and student scope", async () => {
  const calls = [];
  const rows = [
    {
      amount: "100.00",
      cancelled_at: null,
      cancelled_by: null,
      created_at: "2026-07-02 10:00:00",
      created_by: "admin@j12.local",
      currency: "BRL",
      due_date: "2026-07-10",
      enrollment_id: "enrollment-admin-list",
      id: "obligation-list-1",
      metadata_json: null,
      obligation_type: "INITIAL_ENROLLMENT_OBLIGATION",
      plan_id: "plan-list",
      source: "ENROLLMENT",
      status: "PENDING",
      updated_at: "2026-07-02 10:00:00",
    },
    {
      amount: "50.00",
      cancelled_at: null,
      cancelled_by: null,
      created_at: "2026-07-02 11:00:00",
      created_by: "admin@j12.local",
      currency: "BRL",
      due_date: "2026-07-11",
      enrollment_id: "enrollment-admin-list",
      id: "obligation-list-2",
      metadata_json: null,
      obligation_type: "INITIAL_ENROLLMENT_OBLIGATION",
      plan_id: "plan-list",
      source: "ENROLLMENT",
      status: "PAID",
      updated_at: "2026-07-02 11:00:00",
    },
  ];
  const queryRunner = async (sql, params = []) => {
    calls.push({ params, sql });

    if (/j12_mensalidades|j12_financeiro_cobrancas|j12_pagamentos|financial_payments/i.test(sql)) {
      throw new Error(`Unexpected legacy financial read in admin list test: ${sql}`);
    }

    if (sql.includes("WHERE enrollment_id = ?")) {
      assert.deepEqual(params, ["enrollment-admin-list", 50]);
      return rows;
    }

    assert.match(sql, /INNER JOIN enrollment_financial_obligations/);
    assert.deepEqual(params, ["person-admin", "profile-admin", 50]);
    return rows;
  };
  const repository = new MySqlEnrollmentFinancialObligationRepository({ queryRunner });

  const byEnrollment = await repository.listEnrollmentFinancialObligations({
    enrollmentId: "enrollment-admin-list",
  });
  const byStudentScope = await repository.listEnrollmentFinancialObligationsByStudentScope({
    studentPersonId: "person-admin",
    studentProfileId: "profile-admin",
  });

  assert.equal(byEnrollment.length, 2);
  assert.equal(byStudentScope.length, 2);
  assert.equal(byEnrollment[0].amount, 100);
  assert.equal(calls.length, 2);
});

test("MySqlEnrollmentFinancialObligationRepository supports rollback smoke without test data left", async () => {
  let rows = new Map();
  const queryRunner = async (sql, params = []) => {
    if (/j12_mensalidades|j12_financeiro_cobrancas|j12_pagamentos|financial_payments/i.test(sql)) {
      throw new Error(`Unexpected legacy financial write in smoke: ${sql}`);
    }

    if (sql.includes("INSERT INTO")) {
      const [
        id,
        enrollmentId,
        obligationType,
        status,
        amount,
        currency,
        planId,
        dueDate,
        source,
        createdBy,
        metadataJson,
      ] = params;
      const duplicate = Array.from(rows.values()).find(
        (row) => row.enrollment_id === enrollmentId && row.obligation_type === obligationType,
      );

      if (duplicate) {
        const error = new Error(`Duplicate entry for key '${ENROLLMENT_OBLIGATION_UNIQUE_INDEX}'`);
        error.code = "ER_DUP_ENTRY";
        error.errno = 1062;
        throw error;
      }

      rows.set(id, {
        amount,
        cancelled_at: null,
        cancelled_by: null,
        created_at: "2026-07-02 10:00:00",
        created_by: createdBy,
        currency,
        due_date: dueDate,
        enrollment_id: enrollmentId,
        id,
        metadata_json: metadataJson,
        obligation_type: obligationType,
        plan_id: planId,
        source,
        status,
        updated_at: "2026-07-02 10:00:00",
      });
      return { affectedRows: 1 };
    }

    if (sql.includes("WHERE id = ?")) {
      return [rows.get(params[0])].filter(Boolean);
    }

    return Array.from(rows.values()).filter(
      (row) => row.enrollment_id === params[0] && row.obligation_type === params[1],
    );
  };
  const transaction = async (work) => {
    const snapshot = new Map(rows);

    try {
      const result = await work();
      rows = snapshot;
      return result;
    } catch (error) {
      rows = snapshot;
      throw error;
    }
  };
  const repository = new MySqlEnrollmentFinancialObligationRepository({ queryRunner });

  const result = await transaction(async () => {
    const first = await repository.createEnrollmentFinancialObligationRecord({
      enrollmentId: "enrollment-smoke",
      id: "obligation-smoke",
      obligationType: "INITIAL_ENROLLMENT_OBLIGATION",
      status: "PREPARED",
    });
    const duplicate = await repository.createEnrollmentFinancialObligationRecord({
      enrollmentId: "enrollment-smoke",
      id: "obligation-smoke-duplicate",
      obligationType: "INITIAL_ENROLLMENT_OBLIGATION",
      status: "PREPARED",
    });

    return { duplicate, first };
  });

  assert.equal(result.first.created, true);
  assert.equal(result.duplicate.created, false);
  assert.equal(result.duplicate.reused, true);
  assert.equal(rows.size, 0);
});
