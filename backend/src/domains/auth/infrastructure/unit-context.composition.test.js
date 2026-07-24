const assert = require("node:assert/strict");
const test = require("node:test");

const { createUnitContextComposition } = require("./unit-context.composition.js");

test("unit context composition wires resolvers, factory and middlewares without mounting routes", () => {
  const authIdentityApplicationService = {
    findBySourceUser() {},
  };
  const userUnitMembershipApplicationService = {
    checkActiveMembership() {},
    listActiveMembershipsByIdentity() {},
  };

  const composition = createUnitContextComposition({
    authIdentityApplicationService,
    resolveUnit: async () => ({ id: "12", status: "ativo" }),
    userUnitMembershipApplicationService,
  });

  assert.equal(composition.authIdentityApplicationService, authIdentityApplicationService);
  assert.equal(composition.userUnitMembershipApplicationService, userUnitMembershipApplicationService);
  assert.equal(typeof composition.authenticatedAuthIdentityResolver.resolveAuthenticatedAuthIdentity, "function");
  assert.equal(typeof composition.unitContextResolver.resolveUnitContext, "function");
  assert.equal(typeof composition.actorContextFactory.createActorContext, "function");
  assert.equal(typeof composition.unitContextMiddleware, "function");
  assert.equal(typeof composition.actorContextMiddleware, "function");
});
