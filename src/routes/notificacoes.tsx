import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  CalendarClock,
  Check,
  CheckCheck,
  Clock3,
  History,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  Send,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useNotificationCenter } from "@/features/notificacoes/hooks/useNotificationCenter";
import type {
  NotificationChannel,
  NotificationPreference,
} from "@/features/notificacoes/types/notification.types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notificacoes")({
  component: () => (
    <RequireAuth roles={["admin", "coordenador", "professor", "aluno", "responsavel"]}>
      <NotificacoesPage />
    </RequireAuth>
  ),
});

const CHANNELS: Array<{
  channel: NotificationChannel;
  icon: typeof Bell;
  label: string;
  status: string;
}> = [
  { channel: "IN_APP", icon: MonitorSmartphone, label: "Interna", status: "Ativa" },
  { channel: "WHATSAPP", icon: MessageCircle, label: "WhatsApp", status: "Preparada" },
  { channel: "EMAIL", icon: Mail, label: "E-mail", status: "Preparada" },
  { channel: "PUSH", icon: Send, label: "Push", status: "Preparada" },
];

const AGENDA_NOTIFICATION_TYPES = [
  "AGENDA_EVENT_CREATED",
  "AGENDA_EVENT_UPDATED",
  "AGENDA_EVENT_CANCELLED",
  "AGENDA_EVENT_RESCHEDULED",
  "AGENDA_PROFESSOR_CHANGED",
  "AGENDA_COURT_CHANGED",
  "AGENDA_EVENT_REMINDER",
  "AGENDA_RECURRENCE_CHANGED",
];

function NotificacoesPage() {
  const {
    error,
    history,
    isLoading,
    markAllAsRead,
    markAsRead,
    notifications,
    preferences,
    unreadCount,
    updatePreferences,
  } = useNotificationCenter({ historyLimit: 80, limit: 80 });

  const preferencesByChannel = useMemo(
    () => new Map(preferences.map((preference) => [preference.channel, preference])),
    [preferences],
  );

  if (isLoading) {
    return (
      <AppShell title="Notificacoes">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} lines={2} withAvatar className="min-h-[112px]" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Notificacoes">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          {error instanceof Error ? error.message : "Erro ao carregar notificacoes."}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Notificacoes">
      <div className="space-y-6">
        <section className="grid gap-3 md:grid-cols-3">
          <MetricCard icon={Bell} label="Nao lidas" value={unreadCount} />
          <MetricCard icon={History} label="Historico" value={history.length} />
          <MetricCard icon={CalendarClock} label="Eventos da Agenda" value={notifications.length} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Central</h2>
                <p className="text-sm text-slate-400">Eventos, recorrencias e lembretes da Agenda.</p>
              </div>
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary px-4 py-2 text-sm font-bold text-black transition hover:brightness-110"
              >
                <CheckCheck className="h-4 w-4" />
                Marcar todas
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-card p-10 text-center text-slate-400">
                Nenhuma notificacao encontrada.
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <article
                    key={notification.id}
                    className={cn(
                      "rounded-2xl border bg-card p-4 transition",
                      notification.lida
                        ? "border-white/10"
                        : "border-primary/35 shadow-[0_0_0_1px_rgba(255,102,0,0.18)]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-white">{notification.title}</h3>
                          {notification.isRecurringAgendaNotification && (
                            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-primary">
                              Agenda
                            </span>
                          )}
                          {!notification.lida && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold uppercase text-black">
                              Nova
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{notification.message}</p>
                      </div>
                      {!notification.lida && (
                        <button
                          type="button"
                          onClick={() => void markAsRead(notification.id)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-black transition hover:brightness-110"
                          aria-label="Marcar como lida"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDateTime(notification.createdAt)}
                      </span>
                      <span>{notification.notificationType}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-card p-4">
              <div className="mb-4 flex items-center gap-2 text-white">
                <Settings className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">Preferencias</h2>
              </div>
              <div className="space-y-3">
                {CHANNELS.map((item) => (
                  <PreferenceRow
                    key={item.channel}
                    channel={item.channel}
                    icon={item.icon}
                    label={item.label}
                    preference={preferencesByChannel.get(item.channel)}
                    status={item.status}
                    onSave={(payload) => updatePreferences(payload)}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-card p-4">
              <div className="mb-4 flex items-center gap-2 text-white">
                <History className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">Historico</h2>
              </div>
              <div className="space-y-2">
                {history.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
                    Nenhum registro de auditoria.
                  </div>
                ) : (
                  history.slice(0, 12).map((item) => (
                    <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="text-xs font-semibold uppercase text-slate-300">{item.action}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.status || "REGISTRADO"} - {formatDateTime(item.createdAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Bell; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

function PreferenceRow({
  channel,
  icon: Icon,
  label,
  onSave,
  preference,
  status,
}: {
  channel: NotificationChannel;
  icon: typeof Bell;
  label: string;
  onSave: (payload: {
    allowedEnd?: string | null;
    allowedStart?: string | null;
    allowedTypes?: string[];
    channel: NotificationChannel;
    enabled?: boolean;
    mutedUntil?: string | null;
    notificationType: string;
  }) => Promise<unknown>;
  preference?: NotificationPreference;
  status: string;
}) {
  const [allowedEnd, setAllowedEnd] = useState(preference?.allowedEnd || "");
  const [allowedStart, setAllowedStart] = useState(preference?.allowedStart || "");
  const [allowedTypes, setAllowedTypes] = useState<string[]>(preference?.allowedTypes || []);
  const enabled = preference?.enabled ?? true;

  useEffect(() => {
    setAllowedEnd(preference?.allowedEnd || "");
    setAllowedStart(preference?.allowedStart || "");
    setAllowedTypes(preference?.allowedTypes || []);
  }, [preference]);

  const save = (payload: Partial<NotificationPreference>) =>
    onSave({
      allowedEnd: allowedEnd || null,
      allowedStart: allowedStart || null,
      allowedTypes,
      channel,
      enabled,
      notificationType: "AGENDA",
      ...payload,
    });

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{label}</div>
            <div className="text-xs text-slate-500">{status}</div>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={(checked) => void save({ enabled: checked })} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          type="time"
          value={allowedStart}
          onChange={(event) => setAllowedStart(event.target.value)}
          onBlur={() => void save({ allowedStart: allowedStart || null })}
          className="h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white outline-none focus:border-primary/60"
        />
        <input
          type="time"
          value={allowedEnd}
          onChange={(event) => setAllowedEnd(event.target.value)}
          onBlur={() => void save({ allowedEnd: allowedEnd || null })}
          className="h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white outline-none focus:border-primary/60"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {AGENDA_NOTIFICATION_TYPES.map((type) => {
          const selected = allowedTypes.length === 0 || allowedTypes.includes(type);

          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                const nextTypes =
                  allowedTypes.length === 0
                    ? AGENDA_NOTIFICATION_TYPES.filter((item) => item !== type)
                    : allowedTypes.includes(type)
                      ? allowedTypes.filter((item) => item !== type)
                      : [...allowedTypes, type];
                setAllowedTypes(nextTypes);
                void save({ allowedTypes: nextTypes });
              }}
              className={cn(
                "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase transition",
                selected
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-white/10 text-slate-600",
              )}
            >
              {type.replace("AGENDA_", "").replace(/_/g, " ")}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() =>
          void save({
            mutedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          })
        }
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
      >
        Silenciar 24h
      </button>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Sem data";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}
