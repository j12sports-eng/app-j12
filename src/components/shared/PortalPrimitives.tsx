import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type PortalHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
};

type PortalKpiCardProps = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  detail?: ReactNode;
  tone?: "primary" | "success" | "warning" | "danger";
  className?: string;
};

export function PortalHero({
  eyebrow,
  title,
  description,
  children,
  className,
}: PortalHeroProps) {
  return (
    <section className={cn("j12-surface overflow-hidden p-5 md:p-6", className)}>
      <div className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-5xl">{title}</h1>
      {description && (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
          {description}
        </p>
      )}
      {children}
    </section>
  );
}

export function PortalKpiCard({
  label,
  value,
  icon: Icon,
  detail,
  tone = "primary",
  className,
}: PortalKpiCardProps) {
  const toneClass = {
    primary: "border-primary/25 bg-primary/10 text-primary",
    success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    danger: "border-red-400/20 bg-red-500/10 text-red-200",
  }[tone];

  return (
    <div className={cn("j12-kpi-card p-5 md:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {label}
          </p>
          <div className="mt-3 min-h-10 text-2xl font-bold text-white md:text-3xl">{value}</div>
          {detail && <p className="mt-2 text-sm text-slate-400">{detail}</p>}
        </div>
        <div
          className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", toneClass)}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
