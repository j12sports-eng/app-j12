import type { LucideIcon } from "lucide-react";

export type QuickActionWidgetItem = {
  description?: string;
  icon: LucideIcon;
  id: string;
  label: string;
  onSelect: () => void;
};

export function QuickActionsWidget({ actions }: { actions: QuickActionWidgetItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={action.onSelect}
            className="group flex min-h-24 flex-col items-start justify-between rounded-2xl border border-white/10 bg-black/25 p-4 text-left transition hover:border-primary/30 hover:bg-primary/10"
          >
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            <span>
              <strong className="block text-sm text-white">{action.label}</strong>
              {action.description ? (
                <span className="mt-1 block text-xs text-slate-400">{action.description}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
