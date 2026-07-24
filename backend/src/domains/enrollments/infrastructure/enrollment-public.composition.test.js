const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  ENROLLMENT_INVITATION_PUBLIC_ROUTE_PATH,
  createEnrollmentInvitationPublicComposition,
  createEnrollmentInvitationPublicRouter,
} = require("./enrollment-public.composition.js");

test("enrollment public composition exposes GET /matricula/:token without mounting it globally", () => {
  const controller = {
    getByToken() {},
  };
  const composition = createEnrollmentInvitationPublicComposition({
    controller,
    invitationRepository: {},
    invitationResolver: {
      resolveInvitationByRawToken() {},
    },
    resolveEnrollmentInvitationService: {
      resolveByToken() {},
    },
  });
  const router = createEnrollmentInvitationPublicRouter({
    controller,
    invitationRepository: {},
    invitationResolver: {
      resolveInvitationByRawToken() {},
    },
    resolveEnrollmentInvitationService: {
      resolveByToken() {},
    },
  });
  const routes = router.stack.map((layer) => ({
    methods: { ...(layer.route?.methods || {}) },
    path: layer.route?.path,
  }));
  const serverSource = fs.readFileSync(
    path.resolve(__dirname, "../../../server.js"),
    "utf8",
  );

  assert.equal(composition.routePath, ENROLLMENT_INVITATION_PUBLIC_ROUTE_PATH);
  assert.deepEqual(routes, [
    {
      methods: { get: true },
      path: "/matricula/:token",
    },
  ]);
  assert.equal(serverSource.includes("createEnrollmentInvitationPublicRouter"), false);
  assert.equal(serverSource.includes("ENROLLMENT_INVITATION_PUBLIC_ROUTE_PATH"), false);
});
