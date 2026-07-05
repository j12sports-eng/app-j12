const express = require("express");
const { NotificationFacade } = require("../../application/facades/notification.facade.js");
const {
  MySqlNotificationRepository,
} = require("../../infrastructure/repositories/mysql-notification.repository.js");
const {
  NotificationCenterController,
} = require("../controllers/notification-center.controller.js");

const NOTIFICATION_ROUTE_BASE_PATH = "/notifications";
const NOTIFICATION_LEGACY_ROUTE_BASE_PATH = "/notificacoes";

function createNotificationRouter(options = {}) {
  const router = express.Router();
  const controller =
    options.controller ||
    new NotificationCenterController({
      ...options,
      notificationFacade: createNotificationFacade(options),
    });
  const authMiddleware = options.authMiddleware || getRequireAuth();
  const accessMiddleware = options.accessMiddleware || ensureNotificationAdminAccess;

  router.use(authMiddleware);

  router.get("/", controller.listNotifications);
  router.get("/unread-count", controller.countUnread);
  router.get("/history", controller.listHistory);
  router.get("/preferences", controller.getPreferences);
  router.patch("/preferences", controller.updatePreferences);
  router.patch("/read-all", controller.markAllAsRead);
  router.patch("/:notificationId/read", controller.markAsRead);

  router.post("/agenda/events", accessMiddleware, controller.enqueueAgendaEvent);
  router.post("/queue/process", accessMiddleware, controller.processQueue);

  return router;
}

function createNotificationFacade(options = {}) {
  if (options.notificationFacade || options.facade) {
    return options.notificationFacade || options.facade;
  }

  const notificationRepository =
    options.notificationRepository ||
    new MySqlNotificationRepository({
      queryRunner: options.queryRunner || null,
    });

  return new NotificationFacade({
    ...options,
    notificationRepository,
  });
}

function ensureNotificationAdminAccess(req, res, next) {
  const user = req?.auth || req?.user;

  if (getCanManageSystem()(user)) {
    return next();
  }

  return res.status(403).json({
    error: "Sem permissao para administrar notificacoes.",
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
  NOTIFICATION_LEGACY_ROUTE_BASE_PATH,
  NOTIFICATION_ROUTE_BASE_PATH,
  createNotificationFacade,
  createNotificationRouter,
  ensureNotificationAdminAccess,
  getAuthModule,
};
