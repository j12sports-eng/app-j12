const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  ENROLLMENT_INVITATION_PUBLIC_ROUTE_BASE_PATH,
  ENROLLMENT_INVITATION_PUBLIC_ROUTE_PATH,
  createEnrollmentInvitationPublicComposition,
  createEnrollmentInvitationPublicRouter,
} = require("./enrollment-public.composition.js");

test("enrollment public composition exposes the isolated modern public endpoint", () => {
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

  assert.equal(composition.routeBasePath, ENROLLMENT_INVITATION_PUBLIC_ROUTE_BASE_PATH);
  assert.equal(composition.routePath, ENROLLMENT_INVITATION_PUBLIC_ROUTE_PATH);
  assert.deepEqual(routes, [
    {
      methods: { get: true },
      path: "/:token",
    },
  ]);
  assert.equal(serverSource.includes("createEnrollmentInvitationPublicRouter"), true);
  assert.equal(serverSource.includes("ENROLLMENT_INVITATION_PUBLIC_ROUTE_BASE_PATH"), true);
  assert.equal(serverSource.includes("createEnrollmentInvitationAdminRouter"), false);
});
