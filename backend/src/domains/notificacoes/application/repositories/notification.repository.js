/**
 * @typedef {Object} NotificationRepository
 * @property {(event: Record<string, unknown>) => Promise<Record<string, unknown>>} createAgendaNotificationEvent
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>>} enqueueNotificationJob
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>|null>} findNotificationPreference
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>>} recordNotificationAudit
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>[]>} listPendingNotificationJobs
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>>} createNotificationRecord
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>|null>} completeNotificationJob
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>|null>} failNotificationJob
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>[]>} listNotificationCenter
 * @property {(input: Record<string, unknown>) => Promise<number>} countUnreadNotifications
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>|null>} markNotificationRead
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>>} markAllNotificationsRead
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>[]>} listNotificationHistory
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>[]>} listNotificationPreferences
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>>} upsertNotificationPreference
 */

module.exports = {};
