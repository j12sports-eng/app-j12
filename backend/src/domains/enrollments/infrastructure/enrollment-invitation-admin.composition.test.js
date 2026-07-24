const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createEnrollmentInvitationAdminComposition,
} = require("./enrollment-invitation-admin.composition.js");

test("Enrollment invitation admin composition builds fail-closed factory without mounting globally", () => {
  const composition = createEnrollmentInvitationAdminComposition({
    actorContextMiddleware() {},
    enrollmentReader: { findEnrollmentById() {} },
    invitationRepository: { findActiveByEnrollment() {} },
    invitationService: {
      createInvitation() {},
      renewInvitation() {},
      revokeInvitation() {},
    },
    unitContextComposition: {
      actorContextMiddleware() {},
      unitContextMiddleware() {},
      unitContextResolver: { resolveUnitContext() {} },
    },
    unitContextMiddleware() {},
  });

  assert.equal(typeof composition.controller.create, "function");
  assert.equal(typeof composition.invitationAdminService.create, "function");
  assert.equal(typeof composition.routerFactory, "function");
  assert.equal(typeof composition.unitContextMiddleware, "function");
  assert.equal(typeof composition.actorContextMiddleware, "function");
});
