export type NotificationChannel = "EMAIL" | "IN_APP" | "PUSH" | "WHATSAPP";

export type NotificationPreference = {
  allowedEnd?: string | null;
  allowedStart?: string | null;
  allowedTypes?: string[];
  channel: NotificationChannel;
  enabled: boolean;
  id?: string;
  mutedUntil?: string | null;
  notificationType: string;
  recipientId?: string;
  recipientType?: string;
  updatedAt?: string | null;
};

export type NotificationCenterItem = {
  createdAt?: string | null;
  eventId?: string | null;
  id: string;
  isRecurringAgendaNotification?: boolean;
  lida?: boolean;
  message?: string | null;
  mensagem?: string | null;
  notificationType?: string | null;
  readAt?: string | null;
  recipientId?: string | null;
  recipientType?: string | null;
  status?: string | null;
  title?: string | null;
  tipo?: string | null;
  titulo?: string | null;
  type?: string | null;
  updatedAt?: string | null;
};

export type NotificationHistoryItem = {
  action: string;
  createdAt?: string | null;
  details?: Record<string, unknown>;
  eventId?: string | null;
  id: string;
  notificationId?: string | null;
  queueId?: string | null;
  recipientId?: string | null;
  recipientType?: string | null;
  status?: string | null;
};

export type NotificationCenterResponse = {
  items?: NotificationCenterItem[];
  notifications?: NotificationCenterItem[];
  unreadCount?: number;
};

export type NotificationUnreadResponse = {
  unreadCount: number;
};

export type NotificationHistoryResponse = {
  history: NotificationHistoryItem[];
};

export type NotificationPreferencesResponse = {
  preferences: NotificationPreference[];
};

export type NotificationPreferenceUpdatePayload = {
  preferences?: Array<Partial<NotificationPreference>>;
} & Partial<NotificationPreference>;
