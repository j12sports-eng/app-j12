const {
  AGENDA_NOTIFICATION_EVENT_TYPE_INVALID_CODE,
  AGENDA_NOTIFICATION_INPUT_REQUIRED_CODE,
  AGENDA_NOTIFICATION_RECIPIENT_REQUIRED_CODE,
} = require("../../application/contracts/agenda-notification.contract.js");
const {
  AGENDA_NOTIFICATION_NOT_FOUND_CODE,
  AGENDA_NOTIFICATION_REPOSITORY_REQUIRED_CODE,
} = require("../../application/services/agenda-notification.service.js");
const { NotificationFacade } = require("../../application/facades/notification.facade.js");

const NOTIFICATION_SCOPE_REQUIRED_CODE = "NOTIFICATION_SCOPE_REQUIRED";
const NOTIFICATION_ERROR_CODE = "NOTIFICATION_ERROR";

const CONTROLLED_ERROR_STATUS_BY_CODE = Object.freeze({
  [AGENDA_NOTIFICATION_EVENT_TYPE_INVALID_CODE]: 400,
  [AGENDA_NOTIFICATION_INPUT_REQUIRED_CODE]: 400,
  [AGENDA_NOTIFICATION_NOT_FOUND_CODE]: 404,
  [AGENDA_NOTIFICATION_RECIPIENT_REQUIRED_CODE]: 400,
  [AGENDA_NOTIFICATION_REPOSITORY_REQUIRED_CODE]: 500,
  [NOTIFICATION_SCOPE_REQUIRED_CODE]: 400,
});

class NotificationCenterController {
  /**
   * @param {Object} [options]
   * @param {NotificationFacade} [options.notificationFacade]
   * @param {NotificationFacade} [options.facade]
   */
  constructor(options = {}) {
    this.notificationFacade =
      options.notificationFacade || options.facade || new NotificationFacade(options);
    this.canManageSystem = options.canManageSystem || null;

    this.countUnread = this.countUnread.bind(this);
    this.enqueueAgendaEvent = this.enqueueAgendaEvent.bind(this);
    this.getPreferences = this.getPreferences.bind(this);
    this.listHistory = this.listHistory.bind(this);
    this.listNotifications = this.listNotifications.bind(this);
    this.markAllAsRead = this.markAllAsRead.bind(this);
    this.markAsRead = this.markAsRead.bind(this);
    this.processQueue = this.processQueue.bind(this);
    this.updatePreferences = this.updatePreferences.bind(this);
  }

  async listNotifications(req, res, next) {
    try {
      const scope = resolveRecipientScope(req, { canManageSystem: this.canManageSystem });
      const data = await this.getFacade().listNotifications({
        ...scope,
        limit: normalizeLimit(req.query?.limit, 80),
      });

      return sendSuccess(res, {
        items: data,
        notifications: data,
        unreadCount: await this.getFacade().countUnread(scope),
      });
    } catch (error) {
      return handleNotificationError(error, res, next);
    }
  }

  async countUnread(req, res, next) {
    try {
      const scope = resolveRecipientScope(req, { canManageSystem: this.canManageSystem });
      const unreadCount = await this.getFacade().countUnread(scope);

      return sendSuccess(res, { unreadCount });
    } catch (error) {
      return handleNotificationError(error, res, next);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const scope = resolveRecipientScope(req, { canManageSystem: this.canManageSystem });
      const notification = await this.getFacade().markAsRead({
        ...scope,
        notificationId: nullableText(req.params?.notificationId, 64),
      });

      return sendSuccess(res, { notification });
    } catch (error) {
      return handleNotificationError(error, res, next);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const scope = resolveRecipientScope(req, { canManageSystem: this.canManageSystem });
      const data = await this.getFacade().markAllAsRead(scope);

      return sendSuccess(res, data);
    } catch (error) {
      return handleNotificationError(error, res, next);
    }
  }

  async listHistory(req, res, next) {
    try {
      const scope = resolveRecipientScope(req, { canManageSystem: this.canManageSystem });
      const data = await this.getFacade().listHistory({
        ...scope,
        eventId: nullableText(req.query?.eventId, 64),
        limit: normalizeLimit(req.query?.limit, 100),
        notificationId: nullableText(req.query?.notificationId, 64),
      });

      return sendSuccess(res, { history: data });
    } catch (error) {
      return handleNotificationError(error, res, next);
    }
  }

  async getPreferences(req, res, next) {
    try {
      const scope = resolveRecipientScope(req, { canManageSystem: this.canManageSystem });
      const preferences = await this.getFacade().getPreferences(scope);

      return sendSuccess(res, { preferences });
    } catch (error) {
      return handleNotificationError(error, res, next);
    }
  }

  async updatePreferences(req, res, next) {
    try {
      const scope = resolveRecipientScope(req, { canManageSystem: this.canManageSystem });
      const body = readObject(req.body);
      const data = await this.getFacade().updatePreferences({
        ...scope,
        preferences: Array.isArray(body.preferences) ? body.preferences : undefined,
        ...body,
        updatedBy: readActor(req),
      });

      return sendSuccess(res, data);
    } catch (error) {
      return handleNotificationError(error, res, next);
    }
  }

  async enqueueAgendaEvent(req, res, next) {
    try {
      const body = readObject(req.body);
      const data = await this.getFacade().enqueueAgendaNotification({
        ...body,
        actorId: nullableText(body.actorId ?? body.requestedBy ?? readActor(req), 191),
      });

      return sendSuccess(res, data);
    } catch (error) {
      return handleNotificationError(error, res, next);
    }
  }

  async processQueue(req, res, next) {
    try {
      const data = await this.getFacade().processQueue({
        limit: normalizeLimit(req.body?.limit ?? req.query?.limit, 50),
      });

      return sendSuccess(res, data);
    } catch (error) {
      return handleNotificationError(error, res, next);
    }
  }

  getFacade() {
    if (!this.notificationFacade || typeof this.notificationFacade !== "object") {
      throw new TypeError("NotificationCenterController requires a notification facade.");
    }

    return this.notificationFacade;
  }
}

function resolveRecipientScope(req = {}, options = {}) {
  const user = req.auth || req.user || {};
  const query = readObject(req.query);
  const canManageSystem = options.canManageSystem || getCanManageSystem();

  if (canManageSystem(user) && query.recipientType && query.recipientId) {
    return {
      recipientId: requiredText(query.recipientId, "recipientId", 191),
      recipientType: requiredText(query.recipientType, "recipientType", 32).toUpperCase(),
    };
  }

  const role = String(user.role || user.perfil || "").toLowerCase();
  let recipientType = "STUDENT";
  let recipientId =
    user.studentId ?? user.alunoId ?? user.aluno_id ?? user.linked_aluno_id ?? user.id ?? null;

  if (role === "admin" || role === "coordenador") {
    recipientType = "ADMIN";
    recipientId = user.id ?? user.email ?? user.login ?? null;
  } else if (role === "professor") {
    recipientType = "PROFESSOR";
    recipientId = user.teacherId ?? user.professor_id ?? user.id ?? null;
  } else if (role === "responsavel") {
    recipientType = "RESPONSIBLE";
    recipientId = user.responsavelId ?? user.responsavel_id ?? user.id ?? null;
  }

  if (!nullableText(recipientId, 191)) {
    throw controlledError(
      "Nao foi possivel resolver o destinatario das notificacoes.",
      NOTIFICATION_SCOPE_REQUIRED_CODE,
      { role },
    );
  }

  return {
    recipientId: String(recipientId),
    recipientType,
  };
}

function readActor(req = {}) {
  const user = req.auth || req.user || {};
  return nullableText(user.email ?? user.login ?? user.id, 191);
}

function successEnvelope(data) {
  return {
    data,
    success: true,
  };
}

function sendSuccess(res, data) {
  return res.json(successEnvelope(data));
}

function sendControlledError(res, error = {}) {
  const code = nullableText(error.code, 100) || NOTIFICATION_ERROR_CODE;
  const statusCode =
    Number(error.statusCode || error.status) || CONTROLLED_ERROR_STATUS_BY_CODE[code] || 400;

  return res.status(statusCode).json({
    code,
    data: error.details || null,
    error: nullableText(error.message, 500) || "Notification operation failed.",
    success: false,
  });
}

function handleNotificationError(error, res, next) {
  const code = nullableText(error?.code, 100);

  if (code && CONTROLLED_ERROR_STATUS_BY_CODE[code]) {
    return sendControlledError(res, {
      code,
      details: error?.details || null,
      message: error instanceof Error ? error.message : String(error ?? "Notification error."),
      statusCode: CONTROLLED_ERROR_STATUS_BY_CODE[code],
    });
  }

  return next(error);
}

function normalizeLimit(value, fallback = 80) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.trunc(parsed), 200) : fallback;
}

function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);

  if (!normalized) {
    throw controlledError(
      `Campo obrigatorio ausente: ${field}.`,
      NOTIFICATION_SCOPE_REQUIRED_CODE,
      { field },
    );
  }

  return normalized;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function getCanManageSystem() {
  return getAuthModule().canManageSystem;
}

function getAuthModule() {
  return require("../../../../../auth.js");
}

module.exports = {
  CONTROLLED_ERROR_STATUS_BY_CODE,
  NOTIFICATION_ERROR_CODE,
  NOTIFICATION_SCOPE_REQUIRED_CODE,
  NotificationCenterController,
  handleNotificationError,
  resolveRecipientScope,
  successEnvelope,
};
