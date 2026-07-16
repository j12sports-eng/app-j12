import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type AlertWidgetItem = {
  actionLabel?: string;
  description: string;
  icon: LucideIcon;
  id: string;
  onAction?: () => void;
  severity: "critical" | "warning" | "info" | "success";
  title: string;
};

export function AlertWidget({ items }: { items: AlertWidgetItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article
            key={item.id}
            className={cn("rounded-2xl border p-3", severityClass(item.severity))}
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25 text-white">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-white">{item.title}</h3>
                <p className="mt-1 text-sm leading-5 text-slate-300">{item.description}</p>
                {item.onAction && item.actionLabel ? (
                  <button
                    type="button"
                    onClick={item.onAction}
                    className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-primary"
                  >
                    {item.actionLabel}
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function severityClass(severity: AlertWidgetItem["severity"]) {
  return {
    critical: "border-red-400/25 bg-red-500/10",
    info: "border-sky-400/20 bg-sky-500/10",
    success: "border-emerald-400/20 bg-emerald-500/10",
    warning: "border-amber-400/25 bg-amber-500/10",
  }[severity];
}
