import { AlertTriangle, Inbox, RotateCcw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WidgetStateProps = {
  className?: string;
  description?: string;
  title: string;
};

export function WidgetSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "min-h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-4",
        className,
      )}
    >
      <div className="h-3 w-2/5 rounded bg-white/10" />
      <div className="mt-5 h-9 w-3/5 rounded bg-white/10" />
      <div className="mt-4 h-3 w-full rounded bg-white/10" />
      <div className="mt-2 h-3 w-4/5 rounded bg-white/10" />
    </div>
  );
}

export function WidgetEmpty({
  className,
  description = "Não há dados para exibir no período selecionado.",
  title = "Nenhum dado encontrado",
}: Partial<WidgetStateProps>) {
  return (
    <WidgetStateFrame className={className} description={description} icon={Inbox} title={title} />
  );
}

export function WidgetUnavailable({
  className,
  description = "Esta informação ainda não possui uma fonte disponível.",
  title = "Informação indisponível",
}: Partial<WidgetStateProps>) {
  return (
    <WidgetStateFrame
      className={className}
      description={description}
      icon={ShieldAlert}
      title={title}
    />
  );
}

export function WidgetError({
  className,
  description = "Não foi possível carregar este bloco.",
  onRetry,
  title = "Erro ao carregar",
}: Partial<WidgetStateProps> & { onRetry?: () => void }) {
  return (
    <div className={cn("rounded-2xl border border-red-400/20 bg-red-500/10 p-5", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-400/20 bg-black/25 text-red-200">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-black text-white">{title}</p>
            <p className="mt-1 text-sm leading-5 text-red-100/80">{description}</p>
          </div>
        </div>
        {onRetry ? (
          <Button
            type="button"
            onClick={onRetry}
            variant="outline"
            className="border-red-300/20 bg-black/20 text-red-50 hover:bg-red-500/15"
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function WidgetStateFrame({
  className,
  description,
  icon: Icon,
  title,
}: WidgetStateProps & { icon: typeof Inbox }) {
  return (
    <div
      className={cn(
        "grid min-h-40 place-items-center rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center",
        className,
      )}
    >
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm font-black text-white">{title}</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </div>
  );
}
