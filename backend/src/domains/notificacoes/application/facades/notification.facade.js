const {
  AgendaNotificationService,
} = require("../services/agenda-notification.service.js");

/**
 * Application facade for Agenda notification workflows.
 */
class NotificationFacade {
  /**
   * @param {Object} [options]
   * @param {AgendaNotificationService} [options.notificationService]
   * @param {AgendaNotificationService} [options.agendaNotificationService]
   */
  constructor(options = {}) {
    const injectedService = options.notificationService || options.agendaNotificationService;

    this.notificationService =
      injectedService ||
      new AgendaNotificationService({
        adapters: options.adapters,
        clock: options.clock,
        notificationRepository: options.notificationRepository || options.repository,
      });
  }

  enqueueAgendaNotification(input = {}) {
    return this.getNotificationService().enqueueAgendaNotification(input);
  }

  processQueue(input = {}) {
    return this.getNotificationService().processQueue(input);
  }

  listNotifications(input = {}) {
    return this.getNotificationService().listNotifications(input);
  }

  countUnread(input = {}) {
    return this.getNotificationService().countUnread(input);
  }

  markAsRead(input = {}) {
    return this.getNotificationService().markAsRead(input);
  }

  markAllAsRead(input = {}) {
    return this.getNotificationService().markAllAsRead(input);
  }

  listHistory(input = {}) {
    return this.getNotificationService().listHistory(input);
  }

  getPreferences(input = {}) {
    return this.getNotificationService().getPreferences(input);
  }

  updatePreferences(input = {}) {
    return this.getNotificationService().updatePreferences(input);
  }

  /**
   * @returns {AgendaNotificationService}
   */
  getNotificationService() {
    if (!this.notificationService || typeof this.notificationService !== "object") {
      throw new TypeError("NotificationFacade requires a notification service.");
    }

    return this.notificationService;
  }
}

module.exports = {
  NotificationFacade,
};
