const {
  ActorContextFactoryService,
  AuthenticatedAuthIdentityResolverService,
  UnitContextResolverService,
} = require("../application/index.js");
const { createAuthIdentityComposition } = require("./auth-identity.composition.js");
const {
  createUnitResolver,
  createUserUnitMembershipComposition,
} = require("./user-unit-membership.composition.js");
const {
  createActorContextMiddleware,
  createUnitContextMiddleware,
} = require("./middlewares/context-middlewares.js");

function createUnitContextComposition(options = {}) {
  const authIdentityApplicationService =
    options.authIdentityApplicationService ||
    options.authIdentityService ||
    createAuthIdentityComposition(options).authIdentityService;
  const userUnitMembershipApplicationService =
    options.userUnitMembershipApplicationService ||
    options.membershipService ||
    createUserUnitMembershipComposition(options).membershipService;
  const resolveUnit =
    options.resolveUnit || options.unitResolver || createUnitResolver({ queryRunner: options.queryRunner });

  const authenticatedAuthIdentityResolver =
    options.authenticatedAuthIdentityResolver ||
    new AuthenticatedAuthIdentityResolverService({
      authIdentityApplicationService,
      clock: options.clock,
      logger: options.logger,
    });
  const unitContextResolver =
    options.unitContextResolver ||
    new UnitContextResolverService({
      clock: options.clock,
      logger: options.logger,
      resolveUnit,
      userUnitMembershipApplicationService,
    });
  const actorContextFactory =
    options.actorContextFactory ||
    new ActorContextFactoryService({
      logger: options.logger,
    });

  return Object.freeze({
    actorContextFactory,
    actorContextMiddleware: createActorContextMiddleware({
      actorContextFactory,
      authIdentityResolver: authenticatedAuthIdentityResolver,
      headerName: options.headerName,
      unitContextResolver,
    }),
    authenticatedAuthIdentityResolver,
    authIdentityApplicationService,
    unitContextMiddleware: createUnitContextMiddleware({
      authIdentityResolver: authenticatedAuthIdentityResolver,
      headerName: options.headerName,
      unitContextResolver,
    }),
    unitContextResolver,
    userUnitMembershipApplicationService,
  });
}

module.exports = {
  createUnitContextComposition,
};
