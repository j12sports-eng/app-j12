import { api } from "@/lib/api";

import type {
  NotificationCenterResponse,
  NotificationHistoryResponse,
  NotificationPreferenceUpdatePayload,
  NotificationPreferencesResponse,
  NotificationUnreadResponse,
} from "../types/notification.types";

const NOTIFICATIONS_ENDPOINT = "/notifications";

function appendParams(endpoint: string, params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && typeof value !== "undefined" && value !== "") {
      search.set(key, String(value));
    }
  }

  return search.toString() ? `${endpoint}?${search.toString()}` : endpoint;
}

export function listNotifications(input: { limit?: number } = {}) {
  return api.get<NotificationCenterResponse>(
    appendParams(NOTIFICATIONS_ENDPOINT, { limit: input.limit }),
  );
}

export function countUnreadNotifications() {
  return api.get<NotificationUnreadResponse>(`${NOTIFICATIONS_ENDPOINT}/unread-count`);
}

export function markNotificationAsRead(notificationId: string) {
  return api.patch<{ notification: unknown }>(
    `${NOTIFICATIONS_ENDPOINT}/${encodeURIComponent(notificationId)}/read`,
    {},
  );
}

export function markAllNotificationsAsRead() {
  return api.patch<{ markedCount: number; readAll: boolean }>(
    `${NOTIFICATIONS_ENDPOINT}/read-all`,
    {},
  );
}

export function listNotificationHistory(input: { limit?: number; notificationId?: string } = {}) {
  return api.get<NotificationHistoryResponse>(
    appendParams(`${NOTIFICATIONS_ENDPOINT}/history`, {
      limit: input.limit,
      notificationId: input.notificationId,
    }),
  );
}

export function getNotificationPreferences() {
  return api.get<NotificationPreferencesResponse>(`${NOTIFICATIONS_ENDPOINT}/preferences`);
}

export function updateNotificationPreferences(input: NotificationPreferenceUpdatePayload) {
  return api.patch<NotificationPreferencesResponse>(`${NOTIFICATIONS_ENDPOINT}/preferences`, input);
}
