import { Cake } from "lucide-react";

export type BirthdayWidgetItem = {
  dateLabel: string;
  id: string;
  name: string;
  subtitle?: string;
};

export function BirthdayWidget({
  items,
  onSelect,
}: {
  items: BirthdayWidgetItem[];
  onSelect?: (item: BirthdayWidgetItem) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect?.(item)}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-left transition hover:border-primary/30"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Cake className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-sm text-white">{item.name}</strong>
            {item.subtitle ? (
              <span className="block truncate text-xs text-slate-400">{item.subtitle}</span>
            ) : null}
          </span>
          <span className="text-xs font-bold text-primary">{item.dateLabel}</span>
        </button>
      ))}
    </div>
  );
}
