const assert = require("node:assert/strict");
const test = require("node:test");

const { FinancialApplicationService } = require("../services/financial-application.service.js");

const ENROLLMENT_ID = "enrollment-23-13b";
const LEGACY_STUDENT_ID = "legacy-23-13b";

function createHarness(options = {}) {
  const state = {
    bridges: new Map(),
    charges: new Map(),
    installments: new Map(),
    obligations: new Map(),
  };
  let tail = Promise.resolve();
  const calls = { identity: 0, materializer: 0 };

  const repository = {
    async createEnrollmentFinancialObligationRecord(input) {
      const key = `${input.enrollmentId}:${input.obligationType}`;
      const existing = state.obligations.get(key);
      if (existing) return { created: false, obligation: existing, reused: true };
      const obligation = { ...input, id: `obligation-${state.obligations.size + 1}` };
      state.obligations.set(key, obligation);
      return { created: true, obligation, reused: false };
    },
    async findEnrollmentFinancialObligation() {
      return null;
    },
    async runInTransaction(work) {
      const execute = async () => {
        const snapshot = cloneState(state);
        try {
          return await work({
            connection: { execute: async () => [[]] },
            queryRunner: async () => [],
            repository,
          });
        } catch (error) {
          restoreState(state, snapshot);
          throw error;
        }
      };
      const result = tail.then(execute, execute);
      tail = result.catch(() => undefined);
      return result;
    },
  };

  const bridgeFactory = () => ({
    async createBridge(input) {
      if (options.bridgeFailure) throw new Error("bridge failure");
      const existing = state.bridges.get(input.obligationId);
      if (existing) return { bridge: existing, created: false, reused: true };
      const bridge = {
        chargeId: input.chargeId,
        enrollmentId: input.enrollmentId,
        installmentId: input.installmentId,
        legacyStudentId: input.legacyStudentId,
        obligationId: input.obligationId,
      };
      state.bridges.set(input.obligationId, bridge);
      return { bridge, created: true, reused: false };
    },
    async findByObligationId(id) {
      return state.bridges.get(id) || null;
    },
  });

  const materializer = async (_connection, input) => {
    calls.materializer += 1;
    if (options.materializerFailure) throw new Error("materializer failure");
    const chargeId = options.existingChargeId || `charge-${input.legacyStudentId}`;
    const installmentId = options.existingInstallmentId || `installment-${input.legacyStudentId}`;
    state.charges.set(chargeId, { id: chargeId });
    state.installments.set(installmentId, { chargeId, id: installmentId });
    return { chargeId, created: !options.existingChargeId, installmentId };
  };

  const service = new FinancialApplicationService({
    billingSourceReader: async () => ({
      amount: 250,
      billingCycle: "MONTHLY",
      currency: "BRL",
      firstDueDate: "2026-07-20",
      planId: "plan-23-13b",
    }),
    canonicalIdentityService: {
      async resolve(enrollment) {
        calls.identity += 1;
        if (options.missingIdentity || !enrollment.legacyStudentId) {
          const error = new Error("canonical identity missing");
          error.code = "ENROLLMENT_IDENTITY_INPUT_REQUIRED";
          throw error;
        }
        return { enrollment_id: enrollment.id, legacy_student_id: enrollment.legacyStudentId };
      },
    },
    enrollmentReader: {
      async findEnrollmentById() {
        return {
          id: ENROLLMENT_ID,
          status: "ACTIVE",
          studentPersonId: "person-23-13b",
          studentProfileId: "profile-23-13b",
        };
      },
    },
    financialBridgeRepositoryFactory: bridgeFactory,
    financialObligationRepository: repository,
    studentFinanceMaterializer: materializer,
  });

  const create = () =>
    service.createInitialEnrollmentFinancialObligation({
      enrollmentId: ENROLLMENT_ID,
      legacyStudentId: options.missingIdentity ? null : LEGACY_STUDENT_ID,
      requestedBy: "admin@j12.local",
    });

  return { calls, create, state };
}

function cloneState(state) {
  return Object.fromEntries(Object.entries(state).map(([key, value]) => [key, new Map(value)]));
}

function restoreState(target, snapshot) {
  for (const [key, value] of Object.entries(snapshot)) target[key] = new Map(value);
}

test("creates obligation, charge, installment and bridge completely", async () => {
  const harness = createHarness();
  const result = await harness.create();
  assert.equal(result.obligation_id, "obligation-1");
  assert.equal(result.bridge_id, "obligation-1");
  assert.equal(result.charge_id, `charge-${LEGACY_STUDENT_ID}`);
  assert.equal(result.installment_id, `installment-${LEGACY_STUDENT_ID}`);
  assert.equal(result.legacy_student_id, LEGACY_STUDENT_ID);
});

test("retry returns the existing bridge without regenerating finance", async () => {
  const harness = createHarness();
  const first = await harness.create();
  const retry = await harness.create();
  assert.equal(retry.bridge_id, first.bridge_id);
  assert.equal(harness.calls.materializer, 1);
});

test("existing bridge returns immediately", async () => {
  const harness = createHarness();
  await harness.create();
  await harness.create();
  assert.equal(harness.calls.materializer, 1);
  assert.equal(harness.state.bridges.size, 1);
});

test("bridge failure rolls every materialized record back", async () => {
  const harness = createHarness({ bridgeFailure: true });
  await assert.rejects(harness.create, /bridge failure/);
  assert.equal(harness.state.obligations.size, 0);
  assert.equal(harness.state.charges.size, 0);
  assert.equal(harness.state.installments.size, 0);
});

test("intermediate materializer failure rolls obligation back", async () => {
  const harness = createHarness({ materializerFailure: true });
  await assert.rejects(harness.create, /materializer failure/);
  assert.equal(harness.state.obligations.size, 0);
  assert.equal(harness.state.bridges.size, 0);
});

test("concurrent creates converge to one canonical materialization", async () => {
  const harness = createHarness();
  const results = await Promise.all([harness.create(), harness.create()]);
  assert.equal(results[0].bridge_id, results[1].bridge_id);
  assert.equal(harness.state.charges.size, 1);
  assert.equal(harness.calls.materializer, 1);
});

test("repeated creation is idempotent", async () => {
  const harness = createHarness();
  await harness.create();
  await harness.create();
  await harness.create();
  assert.equal(harness.state.obligations.size, 1);
  assert.equal(harness.state.bridges.size, 1);
  assert.equal(harness.state.installments.size, 1);
});

test("existing installment is linked without duplication", async () => {
  const harness = createHarness({ existingInstallmentId: "installment-existing" });
  const result = await harness.create();
  assert.equal(result.installment_id, "installment-existing");
  assert.equal(harness.state.installments.size, 1);
});

test("existing charge is linked without duplication", async () => {
  const harness = createHarness({ existingChargeId: "charge-existing" });
  const result = await harness.create();
  assert.equal(result.charge_id, "charge-existing");
  assert.equal(harness.state.charges.size, 1);
});

test("absence of canonical identity fails before financial writes", async () => {
  const harness = createHarness({ missingIdentity: true });
  await assert.rejects(harness.create, { code: "ENROLLMENT_IDENTITY_INPUT_REQUIRED" });
  assert.equal(harness.state.obligations.size, 0);
  assert.equal(harness.calls.materializer, 0);
});
