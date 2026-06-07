import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

type SkeletonCardProps = SkeletonProps & {
  announce?: boolean;
  lines?: number;
  withAvatar?: boolean;
};

type SkeletonTableProps = SkeletonProps & {
  columns?: number;
  rows?: number;
};

type SkeletonAvatarProps = SkeletonProps & {
  size?: "sm" | "md" | "lg" | "xl";
};

type SkeletonFormProps = SkeletonProps & {
  fields?: number;
  withActions?: boolean;
};

type SkeletonDashboardProps = SkeletonProps & {
  cards?: number;
  panels?: number;
  withHero?: boolean;
};

function Skeleton({ className, ...props }: SkeletonProps) {
  return <div aria-hidden="true" className={cn("j12-skeleton rounded-md", className)} {...props} />;
}

function SkeletonCard({
  announce = true,
  className,
  lines = 3,
  withAvatar = false,
  ...props
}: SkeletonCardProps) {
  return (
    <article
      role={announce ? "status" : undefined}
      aria-busy={announce ? "true" : undefined}
      aria-hidden={announce ? undefined : "true"}
      className={cn("j12-surface min-h-[148px] p-4", className)}
      {...props}
    >
      <div className="flex items-start gap-3">
        {withAvatar ? <SkeletonAvatar size="md" /> : null}
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-4 w-3/5 rounded-full" />
          <Skeleton className="h-7 w-4/5 rounded-xl" />
          <div className="space-y-2">
            {Array.from({ length: lines }).map((_, index) => (
              <Skeleton
                key={index}
                className={cn("h-3 rounded-full", index === lines - 1 ? "w-2/3" : "w-full")}
              />
            ))}
          </div>
        </div>
      </div>
      {announce ? <span className="sr-only">Carregando conteudo</span> : null}
    </article>
  );
}

function SkeletonTable({ className, columns = 5, rows = 6, ...props }: SkeletonTableProps) {
  const gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;

  return (
    <section role="status" aria-busy="true" className={cn("j12-table-shell", className)} {...props}>
      <div className="hidden md:block">
        <div className="j12-table-head grid gap-4 px-4 py-4" style={{ gridTemplateColumns }}>
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={index} className="h-3 rounded-full" />
          ))}
        </div>
        <div className="divide-y divide-border/80">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid min-h-[68px] items-center gap-4 px-4 py-4"
              style={{ gridTemplateColumns }}
            >
              {Array.from({ length: columns }).map((_, columnIndex) => (
                <Skeleton
                  key={columnIndex}
                  className={cn("h-4 rounded-full", columnIndex === 0 ? "w-4/5" : "w-full")}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 p-3 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, index) => (
          <SkeletonCard
            key={index}
            announce={false}
            lines={2}
            withAvatar
            className="min-h-[132px] shadow-none"
          />
        ))}
      </div>
      <span className="sr-only">Carregando tabela</span>
    </section>
  );
}

function SkeletonAvatar({ className, size = "md", ...props }: SkeletonAvatarProps) {
  const sizeClass = {
    sm: "h-9 w-9",
    md: "h-12 w-12",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
  }[size];

  return <Skeleton className={cn("shrink-0 rounded-full", sizeClass, className)} {...props} />;
}

function SkeletonForm({ className, fields = 4, withActions = true, ...props }: SkeletonFormProps) {
  return (
    <section
      role="status"
      aria-busy="true"
      className={cn("j12-surface space-y-5 p-5 md:p-6", className)}
      {...props}
    >
      <div className="flex items-center gap-3">
        <SkeletonAvatar size="md" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-36 rounded-full" />
          <Skeleton className="h-3 w-56 max-w-full rounded-full" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ))}
      </div>

      {withActions ? (
        <div className="flex flex-col gap-3 pt-1 sm:flex-row">
          <Skeleton className="h-12 w-full rounded-2xl sm:w-44" />
          <Skeleton className="h-12 w-full rounded-2xl sm:w-36" />
        </div>
      ) : null}
      <span className="sr-only">Carregando formulario</span>
    </section>
  );
}

function SkeletonDashboard({
  className,
  cards = 4,
  panels = 2,
  withHero = true,
  ...props
}: SkeletonDashboardProps) {
  return (
    <div role="status" aria-busy="true" className={cn("space-y-6", className)} {...props}>
      {withHero ? <Skeleton className="h-40 rounded-3xl md:h-56" /> : null}

      {cards > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: cards }).map((_, index) => (
            <SkeletonCard key={index} announce={false} lines={2} className="min-h-[150px]" />
          ))}
        </section>
      ) : null}

      {panels > 0 ? (
        <section className="grid gap-5 xl:grid-cols-2">
          {Array.from({ length: panels }).map((_, index) => (
            <div key={index} className="j12-surface space-y-4 p-4 md:p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3 w-28 rounded-full" />
                  <Skeleton className="h-6 w-2/3 rounded-xl" />
                </div>
                <SkeletonAvatar size="sm" />
              </div>
              <Skeleton className="h-56 rounded-2xl md:h-72" />
            </div>
          ))}
        </section>
      ) : null}
      <span className="sr-only">Carregando painel</span>
    </div>
  );
}

function GlobalSkeletonFallback() {
  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-6">
      <div className="mx-auto max-w-[1600px]">
        <SkeletonDashboard cards={4} panels={2} />
      </div>
    </main>
  );
}

export {
  GlobalSkeletonFallback,
  Skeleton,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonDashboard,
  SkeletonForm,
  SkeletonTable,
};
