const assert = require("node:assert/strict");
const test = require("node:test");

const { createEnrollmentAdminRouter } = require("./enrollment-admin.routes.js");

test("administrative route integrates ActorContext, facade, service and canonical repository idempotently", async () => {
  const repository = new IntegrationRepository();
  const actorContext = Object.freeze({ unitContext: Object.freeze({ unitId: "12" }) });
  const router = createEnrollmentAdminRouter({
    accessMiddleware: (_req, _res, next) => next(),
    actorContextMiddleware(req, _res, next) {
      req.actorContext = actorContext;
      next();
    },
    authMiddleware: (_req, _res, next) => next(),
    enrollmentRepository: repository,
  });
  const body = {
    responsiblePersonId: "responsible-1",
    startDate: "2026-08-01",
    studentPersonId: "student-1",
    unitId: "999",
  };

  const first = await dispatch(router, body);
  const second = await dispatch(router, body);

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 200);
  assert.equal(first.body.data.enrollmentId, second.body.data.enrollmentId);
  assert.equal(second.body.data.reused, true);
  assert.deepEqual(repository.ownershipCalls, [
    { responsiblePersonId: "responsible-1", studentPersonId: "student-1", unitId: "12" },
    { responsiblePersonId: "responsible-1", studentPersonId: "student-1", unitId: "12" },
  ]);
  assert.equal(repository.createCalls, 1);
  assert.equal(JSON.stringify(first.body).includes("unitId"), false);
  assert.equal(JSON.stringify(first.body).includes("responsibleProfileId"), false);
});

class IntegrationRepository {
  constructor() {
    this.createCalls = 0;
    this.draft = null;
    this.ownershipCalls = [];
  }

  async resolveDraftOpeningOwnership(input) {
    this.ownershipCalls.push({ ...input });
    return {
      responsiblePersonId: input.responsiblePersonId,
      responsibleProfileId: "responsible-profile-1",
      responsibleRelationshipId: "relationship-1",
      studentPersonId: input.studentPersonId,
      studentProfileId: "student-profile-1",
      unitId: input.unitId,
    };
  }

  async findDraftByStudent() {
    return this.draft;
  }
  async findActiveByStudent() {
    return null;
  }
  async validateDraftOwnership() {}

  async create() {
    throw new Error("create bypass must not be used");
  }

  async createDraftIfNotExists(enrollment) {
    this.createCalls += 1;
    this.draft = { ...enrollment.toJSON(), id: "draft-integration-1" };
    return { created: true, enrollment: this.draft, reused: false };
  }
}

async function dispatch(router, body) {
  const response = createResponse();
  await new Promise((resolve, reject) => {
    const originalJson = response.json.bind(response);
    response.json = (payload) => {
      originalJson(payload);
      resolve();
      return response;
    };
    router.handle(
      { body, headers: { "x-unit-id": "998" }, method: "POST", query: { unitId: "997" }, url: "/" },
      response,
      (error) => {
        if (error) reject(error);
        else resolve();
      },
    );
  });
  return response;
}

function createResponse() {
  return {
    body: null,
    statusCode: 200,
    json(body) {
      this.body = body;
      return this;
    },
    setHeader() {},
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}
