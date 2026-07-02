const ENROLLMENT_INTERNAL_API_CONTRACT_VERSION = "sprint-9.45";
const ENROLLMENT_INTERNAL_API_PREPARED_STATUS = "PREPARED_ONLY";

const ENROLLMENT_INTERNAL_API_ROUTES = Object.freeze([
  Object.freeze({
    facadeMethod: "getEnrollmentStatusSummary",
    method: "GET",
    path: "/internal/enrollments/status",
    registered: false,
    requiredInput: ["studentPersonId", "studentProfileId"],
  }),
  Object.freeze({
    facadeMethod: "findCurrentDraftEnrollment",
    method: "GET",
    path: "/internal/enrollments/current-draft",
    registered: false,
    requiredInput: ["studentPersonId", "studentProfileId"],
  }),
  Object.freeze({
    facadeMethod: "findCurrentActiveEnrollment",
    method: "GET",
    path: "/internal/enrollments/current-active",
    registered: false,
    requiredInput: ["studentPersonId", "studentProfileId"],
  }),
  Object.freeze({
    facadeMethod: "confirmDraftEnrollment",
    method: "POST",
    path: "/internal/enrollments/:id/confirm",
    registered: false,
    requiredInput: ["enrollmentId"],
  }),
]);

/**
 * Prepared-only HTTP/API contract for future internal Enrollment endpoints.
 *
 * No Express router is created or registered here.
 *
 * @returns {Record<string, unknown>}
 */
function prepareEnrollmentInternalApiContract() {
  return {
    authPatternRequired: ["requireAuth", "canManageSystem or internal service authorization"],
    contractVersion: ENROLLMENT_INTERNAL_API_CONTRACT_VERSION,
    controllersUseFacade: true,
    errorHandlingPattern: "delegate controlled errors to the global Express error middleware",
    facadeOnly: true,
    frontendChangeRequired: false,
    noPublicEndpointExposed: true,
    payloadValidation: {
      confirm: ["params.id or enrollmentId", "confirmedBy from body or authenticated user"],
      currentActive: ["studentPersonId", "studentProfileId"],
      currentDraft: ["studentPersonId", "studentProfileId"],
      status: ["studentPersonId", "studentProfileId"],
    },
    prepared: true,
    responseShape: {
      error: {
        code: "string",
        error: "string",
        success: false,
      },
      success: {
        data: "object|null",
        success: true,
      },
    },
    routes: ENROLLMENT_INTERNAL_API_ROUTES.map((route) => ({ ...route })),
    routesRegistered: false,
    status: ENROLLMENT_INTERNAL_API_PREPARED_STATUS,
  };
}

module.exports = {
  ENROLLMENT_INTERNAL_API_CONTRACT_VERSION,
  ENROLLMENT_INTERNAL_API_PREPARED_STATUS,
  ENROLLMENT_INTERNAL_API_ROUTES,
  prepareEnrollmentInternalApiContract,
};
