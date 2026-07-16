import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type WidgetShellProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  eyebrow?: string;
  generatedAt?: string;
  title?: string;
};

export function WidgetShell({
  action,
  children,
  className,
  description,
  eyebrow,
  generatedAt,
  title,
}: WidgetShellProps) {
  const hasHeader = Boolean(action || description || eyebrow || generatedAt || title);

  return (
    <section className={cn("j12-surface p-4 md:p-5", className)}>
      {hasHeader ? (
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="mt-2 text-lg font-black tracking-tight text-white md:text-xl">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
            ) : null}
            {generatedAt ? (
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Atualizado em {generatedAt}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}

      <div className={cn(hasHeader && "mt-5")}>{children}</div>
    </section>
  );
}
