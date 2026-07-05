import { Link } from "@tanstack/react-router";
import { Bell, Check, CheckCheck, Clock3, History, Settings } from "lucide-react";
import { useState } from "react";

import { useNotificationCenter } from "@/features/notificacoes/hooks/useNotificationCenter";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { markAllAsRead, markAsRead, notifications, unreadCount } = useNotificationCenter({
    limit: 8,
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10"
        aria-label="Abrir notificacoes"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#101014] shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-white">Notificacoes</div>
              <div className="text-xs text-slate-400">{unreadCount} nao lidas</div>
            </div>
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-primary"
              aria-label="Marcar todas como lidas"
            >
              <CheckCheck className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-2">
            {notifications.length === 0 ? (
              <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 text-sm text-slate-500">
                <Bell className="h-5 w-5" />
                Nenhuma notificacao
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "mb-2 rounded-xl border p-3 transition",
                    item.lida
                      ? "border-white/8 bg-white/[0.03]"
                      : "border-primary/35 bg-primary/[0.08]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{item.title}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                        {item.message}
                      </p>
                    </div>
                    {!item.lida && (
                      <button
                        type="button"
                        onClick={() => void markAsRead(item.id)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-black transition hover:brightness-110"
                        aria-label="Marcar notificacao como lida"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] uppercase text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span className="truncate">{item.notificationType}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="grid grid-cols-2 border-t border-white/10">
            <Link
              to="/notificacoes"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center gap-2 px-3 py-3 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <History className="h-4 w-4" />
              Historico
            </Link>
            <Link
              to="/notificacoes"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center gap-2 border-l border-white/10 px-3 py-3 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <Settings className="h-4 w-4" />
              Preferencias
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
