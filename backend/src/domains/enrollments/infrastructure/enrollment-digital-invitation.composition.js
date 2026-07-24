const { EnrollmentDigitalInvitationService } = require("../application/services/enrollment-digital-invitation.service.js");
const { EnrollmentFacade } = require("../application/facades/enrollment.facade.js");
const { MySqlEnrollmentDigitalInvitationRepository } = require("./repositories/mysql-enrollment-digital-invitation.repository.js");
const { MySqlEnrollmentRepository } = require("./repositories/mysql-enrollment.repository.js");

function createEnrollmentDigitalInvitationService(options = {}) {
  const enrollmentRepository =
    options.enrollmentRepository || new MySqlEnrollmentRepository(options.enrollmentRepositoryOptions || {});
  const enrollmentFacade =
    options.enrollmentFacade || new EnrollmentFacade({ enrollmentRepository });
  const invitationRepository =
    options.invitationRepository ||
    new MySqlEnrollmentDigitalInvitationRepository(options.invitationRepositoryOptions || {});

  return new EnrollmentDigitalInvitationService({
    authorizeEnrollmentInvitation: options.authorizeEnrollmentInvitation || null,
    clock: options.clock,
    defaultDurationSeconds: options.defaultDurationSeconds,
    enrollmentReader: enrollmentFacade,
    invitationRepository,
    logger: options.logger,
    tokenGenerator: options.tokenGenerator,
  });
}

module.exports = {
  createEnrollmentDigitalInvitationService,
};
