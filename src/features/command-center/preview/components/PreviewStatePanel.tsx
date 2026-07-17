import type { ReactNode } from "react";

export type PreviewStatePanelProps = {
  action?: ReactNode;
  icon?: ReactNode;
  message: string;
  title: string;
};

/** Standard accessible panel for loading, empty and error preview states. */
export function PreviewStatePanel({ action, icon, message, title }: PreviewStatePanelProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-6" aria-live="polite">
      <div className="flex items-center gap-3">
        {icon}
        <h2 className="font-black text-white">{title}</h2>
      </div>
      <p className="mt-3 text-sm text-slate-400">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
