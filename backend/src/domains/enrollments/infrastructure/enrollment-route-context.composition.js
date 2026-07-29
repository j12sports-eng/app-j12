const {
  createUnitContextComposition,
} = require("../../auth/infrastructure/unit-context.composition.js");

// Enrollment ownership is selected only from persisted server-side memberships.
function ignoreEnrollmentClientUnitSelection() {
  return null;
}

function createEnrollmentRouteContextComposition(options = {}) {
  const unitContextComposition =
    options.unitContextComposition ||
    createUnitContextComposition({
      ...options,
      requestedUnitIdReader: ignoreEnrollmentClientUnitSelection,
    });

  return Object.freeze({
    actorContextMiddleware:
      options.actorContextMiddleware || unitContextComposition.actorContextMiddleware,
    unitContextMiddleware:
      options.unitContextMiddleware || unitContextComposition.unitContextMiddleware,
    unitContextResolver: unitContextComposition.unitContextResolver,
  });
}

function createEnrollmentActorContextMiddleware(options = {}) {
  if (typeof options.actorContextMiddleware === "function") {
    return options.actorContextMiddleware;
  }

  return createEnrollmentRouteContextComposition(options).actorContextMiddleware;
}

module.exports = {
  createEnrollmentActorContextMiddleware,
  createEnrollmentRouteContextComposition,
  ignoreEnrollmentClientUnitSelection,
};
