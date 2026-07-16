import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { WidgetShell } from "@/features/command-center/components/states/WidgetShell";

type CommandCenterSectionProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description: string;
  eyebrow: string;
  generatedAt?: string;
  icon?: LucideIcon;
  title: string;
};

export function CommandCenterSection({
  action,
  children,
  className,
  description,
  eyebrow,
  generatedAt,
  icon: Icon,
  title,
}: CommandCenterSectionProps) {
  const sectionAction =
    action ||
    (Icon ? (
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
    ) : null);

  return (
    <WidgetShell
      action={sectionAction}
      className={className}
      description={description}
      eyebrow={eyebrow}
      generatedAt={generatedAt}
      title={title}
    >
      {children}
    </WidgetShell>
  );
}
