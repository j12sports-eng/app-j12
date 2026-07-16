const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MySqlEnrollmentFinancialBridgeRepository,
} = require("./mysql-enrollment-financial-bridge.repository.js");

const INPUT = Object.freeze({
  chargeId: "charge-1",
  createdBy: "admin@j12.local",
  enrollmentId: "enrollment-1",
  installmentId: "installment-1",
  legacyStudentId: "legacy-1",
  obligationId: "obligation-1",
  status: "LINKED",
});

test("returns null when bridge does not exist", async () => {
  const repository = createRepository(async () => [[]]);
  assert.equal(await repository.findByObligationId("missing"), null);
});

test("consults an existing bridge by every bidirectional identity", async () => {
  const row = toRow(INPUT);
  const repository = createRepository(async () => [[row]]);

  assert.equal((await repository.findByObligationId(INPUT.obligationId)).chargeId, INPUT.chargeId);
  assert.equal((await repository.findByChargeId(INPUT.chargeId)).obligationId, INPUT.obligationId);
  assert.equal(
    (await repository.findByInstallmentId(INPUT.installmentId)).legacyStudentId,
    INPUT.legacyStudentId,
  );
});

test("rejects duplicate unique identity with different bridge data", async () => {
  let call = 0;
  const repository = createRepository(async () => {
    call += 1;
    if (call === 1) throw duplicateError();
    return [[toRow({ ...INPUT, chargeId: "other-charge" })]];
  });

  await assert.rejects(
    repository.createBridge(INPUT),
    (error) => error?.code === "ENROLLMENT_FINANCIAL_BRIDGE_DUPLICATE",
  );
});

test("transaction runner rolls back when bridge insert fails", async () => {
  const state = { commits: 0, rollbacks: 0 };
  const repository = new MySqlEnrollmentFinancialBridgeRepository({
    transactionRunner: createTrackingTransaction(async () => {
      const error = new Error("invalid foreign key");
      error.code = "ER_NO_REFERENCED_ROW_2";
      throw error;
    }, state),
  });

  await assert.rejects(repository.createBridge(INPUT), /invalid foreign key/);
  assert.deepEqual(state, { commits: 0, rollbacks: 1 });
});

test("retry reuses the exact bridge after duplicate insert", async () => {
  let call = 0;
  const repository = createRepository(async () => {
    call += 1;
    if (call === 1) throw duplicateError();
    return [[toRow(INPUT)]];
  });

  const result = await repository.createBridge(INPUT);
  assert.equal(result.created, false);
  assert.equal(result.reused, true);
  assert.equal(result.bridge.obligationId, INPUT.obligationId);
});

test("invalid foreign key fails closed without conversion to duplicate", async () => {
  const repository = createRepository(async () => {
    const error = new Error("foreign key fails");
    error.code = "ER_NO_REFERENCED_ROW_2";
    throw error;
  });

  await assert.rejects(
    repository.createBridge(INPUT),
    (error) => error?.code === "ER_NO_REFERENCED_ROW_2",
  );
});

test("repeated create is idempotent", async () => {
  const database = createInMemoryBridgeDatabase();
  const repository = createRepository(database.execute);

  const first = await repository.createBridge(INPUT);
  const second = await repository.createBridge(INPUT);

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.reused, true);
  assert.equal(database.rows.size, 1);
});

test("concurrent creates converge to one bridge", async () => {
  const database = createInMemoryBridgeDatabase();
  const firstRepository = createRepository(database.execute);
  const secondRepository = createRepository(database.execute);

  const results = await Promise.all([
    firstRepository.createBridge(INPUT),
    secondRepository.createBridge(INPUT),
  ]);

  assert.equal(results.filter((result) => result.created).length, 1);
  assert.equal(results.filter((result) => result.reused).length, 1);
  assert.equal(database.rows.size, 1);
});

function createRepository(execute) {
  return new MySqlEnrollmentFinancialBridgeRepository({
    transactionRunner: async (work) => work({ execute }),
  });
}

function createTrackingTransaction(execute, state) {
  return async (work) => {
    try {
      const result = await work({ execute });
      state.commits += 1;
      return result;
    } catch (error) {
      state.rollbacks += 1;
      throw error;
    }
  };
}

function createInMemoryBridgeDatabase() {
  const rows = new Map();

  return {
    rows,
    async execute(sql, params) {
      if (/INSERT INTO enrollment_financial_bridges/.test(sql)) {
        const obligationId = params[0];
        await Promise.resolve();
        if (rows.has(obligationId)) throw duplicateError();
        rows.set(
          obligationId,
          toRow({
            chargeId: params[1],
            createdBy: params[6],
            enrollmentId: params[4],
            installmentId: params[2],
            legacyStudentId: params[3],
            obligationId,
            status: params[5],
          }),
        );
        return [{ affectedRows: 1 }];
      }

      return [[rows.get(params[0])].filter(Boolean)];
    },
  };
}

function duplicateError() {
  const error = new Error("Duplicate entry");
  error.code = "ER_DUP_ENTRY";
  error.errno = 1062;
  return error;
}

function toRow(input) {
  return {
    charge_id: input.chargeId,
    created_at: "2026-07-15 14:30:00",
    created_by: input.createdBy,
    enrollment_id: input.enrollmentId,
    installment_id: input.installmentId,
    legacy_student_id: input.legacyStudentId,
    obligation_id: input.obligationId,
    status: input.status,
    updated_at: "2026-07-15 14:30:00",
  };
}
