import { Bell } from "lucide-react";

export type NotificationWidgetItem = {
  description: string;
  id: string;
  read: boolean;
  title: string;
};

export function NotificationsWidget({
  items,
  onSelect,
}: {
  items: NotificationWidgetItem[];
  onSelect?: (item: NotificationWidgetItem) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect?.(item)}
          className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-left"
        >
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <strong className="block text-sm text-white">{item.title}</strong>
            <span className="mt-1 block text-sm text-slate-400">{item.description}</span>
          </span>
          {!item.read ? (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" />
          ) : null}
        </button>
      ))}
    </div>
  );
}
