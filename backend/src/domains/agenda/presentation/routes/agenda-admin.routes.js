const express = require("express");
const { ClassFacade } = require("../../../classes/application/facades/class.facade.js");
const {
  MySqlClassRepository,
} = require("../../../classes/infrastructure/repositories/mysql-class.repository.js");
const { EnrollmentFacade } = require("../../../enrollments/application/facades/enrollment.facade.js");
const {
  MySqlEnrollmentRepository,
} = require("../../../enrollments/infrastructure/repositories/mysql-enrollment.repository.js");
const { AgendaFacade } = require("../../application/facades/agenda.facade.js");
const {
  MySqlAgendaRepository,
} = require("../../infrastructure/repositories/mysql-agenda.repository.js");
const {
  AgendaAdminController,
} = require("../controllers/agenda-admin.controller.js");

const AGENDA_ADMIN_ROUTE_BASE_PATH = "/admin/agenda";

/**
 * Creates the administrative Agenda router.
 *
 * The router follows the same authenticated management guard used by the
 * existing Enrollment and Financeiro admin routes.
 */
function createAgendaAdminRouter(options = {}) {
  const router = express.Router();
  const controller =
    options.controller ||
    new AgendaAdminController({
      ...options,
      agendaFacade: createAgendaAdminFacade(options),
    });
  const authMiddleware = options.authMiddleware || getRequireAuth();
  const accessMiddleware = options.accessMiddleware || ensureAgendaAdminAccess;

  router.use(authMiddleware);
  router.use(accessMiddleware);

  router.get("/students/:studentPersonId/:studentProfileId/summary", controller.getStudentSummary);
  router.get("/enrollments/:enrollmentId/summary", controller.getEnrollmentSummary);
  router.get("/classes/:classId/schedules", controller.getClassSchedules);
  router.post("/events/validate", controller.validateEvent);
  router.patch("/events/:eventId/reschedule", controller.rescheduleEvent);
  router.post("/recurrences/preview", controller.previewRecurrence);
  router.post("/recurrences", controller.createRecurrenceSeries);
  router.get("/recurrences/:seriesId", controller.getRecurrenceSeries);
  router.patch("/recurrences/:seriesId", controller.updateRecurrence);
  router.delete("/recurrences/:seriesId", controller.cancelRecurrence);
  router.patch(
    "/recurrences/:seriesId/occurrences/:occurrenceKey",
    controller.updateRecurrence,
  );
  router.delete(
    "/recurrences/:seriesId/occurrences/:occurrenceKey",
    controller.cancelRecurrence,
  );

  return router;
}

function createAgendaAdminFacade(options = {}) {
  if (options.agendaFacade || options.facade) {
    return options.agendaFacade || options.facade;
  }

  const queryRunner = options.queryRunner || null;
  const agendaRepository =
    options.agendaRepository ||
    new MySqlAgendaRepository({
      queryRunner,
    });
  const classFacade = options.classFacade || createAgendaClassFacade(options);
  const enrollmentFacade = options.enrollmentFacade || createAgendaEnrollmentFacade(options);

  return new AgendaFacade({
    ...options,
    agendaRepository,
    classFacade,
    enrollmentFacade,
  });
}

function createAgendaClassFacade(options = {}) {
  if (options.classFacade) {
    return options.classFacade;
  }

  const classRepository =
    options.classRepository ||
    new MySqlClassRepository({
      queryRunner: options.queryRunner || null,
    });

  return new ClassFacade({
    classRepository,
  });
}

function createAgendaEnrollmentFacade(options = {}) {
  if (options.enrollmentFacade) {
    return options.enrollmentFacade;
  }

  const enrollmentRepository =
    options.enrollmentRepository ||
    new MySqlEnrollmentRepository({
      logger: options.logger || console,
      lockTimeoutSeconds: options.lockTimeoutSeconds,
      queryRunner: options.queryRunner || null,
    });

  return new EnrollmentFacade({
    enrollmentRepository,
    eventDispatcher: options.eventDispatcher || undefined,
    logger: options.logger || console,
  });
}

function ensureAgendaAdminAccess(req, res, next) {
  const user = req?.auth || req?.user;

  if (getCanManageSystem()(user)) {
    return next();
  }

  return res.status(403).json({
    error: "Sem permissao para administrar agenda.",
    success: false,
  });
}

function getRequireAuth() {
  return getAuthModule().requireAuth;
}

function getCanManageSystem() {
  return getAuthModule().canManageSystem;
}

function getAuthModule() {
  return require("../../../../../auth.js");
}

module.exports = {
  AGENDA_ADMIN_ROUTE_BASE_PATH,
  createAgendaAdminFacade,
  createAgendaAdminRouter,
  createAgendaClassFacade,
  createAgendaEnrollmentFacade,
  ensureAgendaAdminAccess,
  getAuthModule,
};
