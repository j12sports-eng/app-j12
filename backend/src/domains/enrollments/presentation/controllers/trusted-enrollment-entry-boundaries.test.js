const assert = require("node:assert/strict");
const test = require("node:test");

const {
  EnrollmentInternalController: FutureEnrollmentInternalController,
} = require("../../application/http/enrollment-internal.controller.js");
const {
  ENROLLMENT_TRUSTED_UNIT_CONTEXT_REQUIRED_CODE,
  readTrustedEnrollmentContext,
} = require("../../application/security/trusted-enrollment-context.js");
const { EnrollmentAdminController } = require("./enrollment-admin.controller.js");
const { EnrollmentInternalController } = require("./enrollment-internal.controller.js");
const { EnrollmentPublicController } = require("./enrollment-public.controller.js");

const EXPRESS_BOUNDARIES = [
  ["admin", EnrollmentAdminController, true],
  ["secured public", EnrollmentPublicController, true],
  ["internal", EnrollmentInternalController, false],
];

for (const [name, Controller, handlesTrustedError] of EXPRESS_BOUNDARIES) {
  test(`${name} Enrollment boundary uses only authenticated actor unit`, async () => {
    const calls = [];
    const facade = {
      async getEnrollmentStatusSummary(input) {
        calls.push(input);
        return { status: "NONE" };
      },
    };
    const controller = new Controller({ enrollmentFacade: facade });
    const actorContext = Object.freeze({
      authIdentityId: "identity-1",
      unitContext: Object.freeze({ unitId: "12" }),
    });
    const request = hostileRequest({ actorContext });
    const actorSnapshot = JSON.stringify(actorContext);
    const res = response();
    let nextError = null;

    await controller.getStatus(request, res, (error) => {
      nextError = error;
    });

    assert.equal(nextError, null);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls, [
      {
        studentPersonId: "person-1",
        studentProfileId: "profile-1",
        unitId: "12",
      },
    ]);
    assert.equal(JSON.stringify(actorContext), actorSnapshot);
  });

  test(`${name} Enrollment boundary fails closed without canonical unit membership`, async () => {
    let serviceCalls = 0;
    const controller = new Controller({
      enrollmentFacade: {
        async getEnrollmentStatusSummary() {
          serviceCalls += 1;
          return { status: "NONE" };
        },
      },
    });
    const res = response();
    let nextError = null;

    await controller.getStatus(hostileRequest(), res, (error) => {
      nextError = error;
    });

    assert.equal(serviceCalls, 0);
    if (handlesTrustedError) {
      assert.equal(nextError, null);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, ENROLLMENT_TRUSTED_UNIT_CONTEXT_REQUIRED_CODE);
    } else {
      assert.equal(nextError?.code, ENROLLMENT_TRUSTED_UNIT_CONTEXT_REQUIRED_CODE);
      assert.equal(nextError?.statusCode, 403);
      assert.equal(res.body, null);
    }
  });
}

test("confirmation keeps trusted context separate from hostile client command", async () => {
  const calls = [];
  const controller = new EnrollmentAdminController({
    enrollmentFacade: {
      async confirmDraftEnrollment(input, context) {
        calls.push({ context, input });
        return { confirmed: true, status: "ACTIVE" };
      },
    },
  });
  const actorContext = Object.freeze({
    authIdentityId: "identity-1",
    unitContext: Object.freeze({ unitId: "12" }),
  });
  const request = hostileRequest({
    actorContext,
    auth: { email: "actor@example.test", unitId: "999" },
    body: {
      confirmedBy: "actor@example.test",
      enrollmentId: "body-enrollment",
      unitId: "999",
      unit_id: "999",
    },
    params: { enrollmentId: "draft-1", unitId: "999" },
  });
  const res = response();

  await controller.confirmDraft(request, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls[0].input, {
    confirmedBy: "actor@example.test",
    enrollmentId: "draft-1",
  });
  assert.deepEqual(calls[0].context, { unitId: "12" });
  assert.equal(Object.isFrozen(calls[0].context), true);
  assert.equal("unitId" in calls[0].input, false);
});

test("trusted Enrollment context extractor ignores every client-controlled unit source", () => {
  const request = hostileRequest({
    auth: { unitId: "999" },
    unitContext: { unitId: "999" },
    user: { unitId: "999" },
  });

  assert.throws(() => readTrustedEnrollmentContext(request), {
    code: ENROLLMENT_TRUSTED_UNIT_CONTEXT_REQUIRED_CODE,
    statusCode: 403,
  });
});

test("future internal boundary remains blocked until canonical actor context is composed", async () => {
  let facadeCalls = 0;
  const controller = new FutureEnrollmentInternalController({
    enrollmentFacade: {
      async getEnrollmentStatusSummary() {
        facadeCalls += 1;
        return { status: "NONE" };
      },
    },
  });

  await assert.rejects(() => controller.getStatus(hostileRequest()), {
    code: ENROLLMENT_TRUSTED_UNIT_CONTEXT_REQUIRED_CODE,
    statusCode: 403,
  });
  assert.equal(facadeCalls, 0);
});

test("future internal boundary propagates canonical unit without client overrides", async () => {
  const calls = [];
  const controller = new FutureEnrollmentInternalController({
    enrollmentFacade: {
      async getEnrollmentStatusSummary(input) {
        calls.push(input);
        return { status: "NONE" };
      },
    },
  });

  const result = await controller.getStatus(
    hostileRequest({
      actorContext: {
        authIdentityId: "identity-1",
        unitContext: { unitId: "12" },
      },
    }),
  );

  assert.deepEqual(result, {
    data: { status: "NONE" },
    success: true,
  });
  assert.deepEqual(calls, [
    {
      studentPersonId: "person-1",
      studentProfileId: "profile-1",
      unitId: "12",
    },
  ]);
});

function hostileRequest(overrides = {}) {
  return {
    body: { unitId: "999", unit_id: "999" },
    headers: { "x-unit-id": "999" },
    params: { unitId: "999" },
    query: {
      studentPersonId: "person-1",
      studentProfileId: "profile-1",
      unitId: "999",
      unit_id: "999",
    },
    ...overrides,
  };
}

function response() {
  return {
    body: null,
    statusCode: 200,
    json(payload) {
      this.body = payload;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}
