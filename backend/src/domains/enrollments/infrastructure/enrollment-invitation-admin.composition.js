const {
  createUnitContextComposition,
} = require("../../auth/infrastructure/unit-context.composition.js");
const { EnrollmentFacade } = require("../application/facades/enrollment.facade.js");
const {
  EnrollmentInvitationAdminApplicationService,
} = require("../application/services/enrollment-invitation-admin-application.service.js");
const {
  EnrollmentDigitalInvitationService,
} = require("../application/services/enrollment-digital-invitation.service.js");
const {
  EnrollmentInvitationAdminController,
} = require("../presentation/controllers/enrollment-invitation-admin.controller.js");
const {
  createEnrollmentInvitationAdminRouter,
} = require("../presentation/routes/enrollment-invitation-admin.routes.js");
const {
  MySqlEnrollmentDigitalInvitationRepository,
} = require("./repositories/mysql-enrollment-digital-invitation.repository.js");
const { MySqlEnrollmentRepository } = require("./repositories/mysql-enrollment.repository.js");

function createEnrollmentInvitationAdminComposition(options = {}) {
  const enrollmentRepository =
    options.enrollmentRepository || new MySqlEnrollmentRepository(options.enrollmentRepositoryOptions || {});
  const enrollmentReader =
    options.enrollmentReader || options.enrollmentFacade || new EnrollmentFacade({ enrollmentRepository });
  const invitationRepository =
    options.invitationRepository ||
    new MySqlEnrollmentDigitalInvitationRepository(options.invitationRepositoryOptions || {});
  const unitContextComposition =
    options.unitContextComposition || createUnitContextComposition(options);
  const invitationService =
    options.invitationService ||
    new EnrollmentDigitalInvitationService({
      authorizeEnrollmentInvitation: options.authorizeEnrollmentInvitation || (async () => true),
      clock: options.clock,
      defaultDurationSeconds: options.defaultDurationSeconds,
      enrollmentReader,
      invitationRepository,
      logger: options.logger,
      tokenGenerator: options.tokenGenerator,
    });
  const invitationAdminService =
    options.invitationAdminService ||
    new EnrollmentInvitationAdminApplicationService({
      enrollmentReader,
      invitationRepository,
      invitationService,
      logger: options.logger,
      unitContextResolver: unitContextComposition.unitContextResolver,
    });
  const controller =
    options.controller ||
    new EnrollmentInvitationAdminController({
      invitationAdminService,
      logger: options.logger,
    });

  return Object.freeze({
    actorContextMiddleware: options.actorContextMiddleware || unitContextComposition.actorContextMiddleware,
    controller,
    enrollmentReader,
    enrollmentRepository,
    invitationAdminService,
    invitationRepository,
    invitationService,
    routerFactory: createEnrollmentInvitationAdminRouter,
    unitContextMiddleware: options.unitContextMiddleware || unitContextComposition.unitContextMiddleware,
  });
}

function createEnrollmentInvitationAdminComposedRouter(options = {}) {
  const composition = createEnrollmentInvitationAdminComposition(options);
  return createEnrollmentInvitationAdminRouter({
    actorContextMiddleware: composition.actorContextMiddleware,
    controller: composition.controller,
    authMiddleware: options.authMiddleware,
    roleGuardFactory: options.roleGuardFactory,
    unitContextMiddleware: composition.unitContextMiddleware,
  });
}

module.exports = {
  createEnrollmentInvitationAdminComposedRouter,
  createEnrollmentInvitationAdminComposition,
};
