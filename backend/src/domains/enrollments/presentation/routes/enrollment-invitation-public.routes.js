"use strict";

const {
  ENROLLMENT_INVITATION_PUBLIC_ROUTE_BASE_PATH,
  createEnrollmentInvitationPublicRouter: createInfrastructureRouter,
} = require("../../infrastructure/enrollment-public.composition.js");

function createEnrollmentInvitationPublicRouter(options = {}) {
  return createInfrastructureRouter(options);
}

module.exports = {
  ENROLLMENT_INVITATION_PUBLIC_ROUTE_BASE_PATH,
  createEnrollmentInvitationPublicRouter,
};
