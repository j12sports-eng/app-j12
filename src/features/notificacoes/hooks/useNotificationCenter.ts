import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ensureSocketConnected, socket } from "@/lib/socket";

import {
  countUnreadNotifications,
  getNotificationPreferences,
  listNotificationHistory,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  updateNotificationPreferences,
} from "../api/notifications.api";

import type { NotificationCenterItem } from "../types/notification.types";

export const notificationQueryKey = {
  all: ["notifications"] as const,
  center: (limit: number) => ["notifications", "center", limit] as const,
  history: (limit: number) => ["notifications", "history", limit] as const,
  preferences: ["notifications", "preferences"] as const,
  unread: ["notifications", "unread"] as const,
};

type UseNotificationCenterInput = {
  enabled?: boolean;
  historyLimit?: number;
  limit?: number;
};

export function useNotificationCenter({
  enabled = true,
  historyLimit = 80,
  limit = 50,
}: UseNotificationCenterInput = {}) {
  const queryClient = useQueryClient();

  const centerQuery = useQuery({
    enabled,
    queryFn: () => listNotifications({ limit }),
    queryKey: notificationQueryKey.center(limit),
  });
  const unreadQuery = useQuery({
    enabled,
    queryFn: countUnreadNotifications,
    queryKey: notificationQueryKey.unread,
  });
  const historyQuery = useQuery({
    enabled,
    queryFn: () => listNotificationHistory({ limit: historyLimit }),
    queryKey: notificationQueryKey.history(historyLimit),
  });
  const preferencesQuery = useQuery({
    enabled,
    queryFn: getNotificationPreferences,
    queryKey: notificationQueryKey.preferences,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => invalidateNotificationQueries(queryClient),
  });
  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => invalidateNotificationQueries(queryClient),
  });
  const updatePreferencesMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => invalidateNotificationQueries(queryClient),
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    ensureSocketConnected();

    const refresh = () => invalidateNotificationQueries(queryClient);

    socket.on("nova_notificacao", refresh);

    return () => {
      socket.off("nova_notificacao", refresh);
    };
  }, [enabled, queryClient]);

  const notifications = normalizeNotifications(
    centerQuery.data?.items || centerQuery.data?.notifications || [],
  );
  const unreadCount = Number(
    unreadQuery.data?.unreadCount ?? centerQuery.data?.unreadCount ?? notifications.filter((item) => !item.lida).length,
  );

  return {
    error: centerQuery.error || unreadQuery.error || null,
    history: historyQuery.data?.history || [],
    isLoading: centerQuery.isLoading || unreadQuery.isLoading,
    isMarkingAllRead: markAllReadMutation.isPending,
    isMarkingRead: markReadMutation.isPending,
    isSavingPreferences: updatePreferencesMutation.isPending,
    markAllAsRead: markAllReadMutation.mutateAsync,
    markAsRead: markReadMutation.mutateAsync,
    notifications,
    preferences: preferencesQuery.data?.preferences || [],
    refresh: () => invalidateNotificationQueries(queryClient),
    unreadCount,
    updatePreferences: updatePreferencesMutation.mutateAsync,
  };
}

function invalidateNotificationQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: notificationQueryKey.all });
}

function normalizeNotifications(items: NotificationCenterItem[]) {
  return items.map((item) => ({
    ...item,
    lida: Boolean(item.lida || item.readAt || item.status === "READ"),
    message: item.message ?? item.mensagem ?? "",
    notificationType: item.notificationType ?? item.type ?? item.tipo ?? "AGENDA",
    title: item.title ?? item.titulo ?? "Notificacao",
  }));
}
