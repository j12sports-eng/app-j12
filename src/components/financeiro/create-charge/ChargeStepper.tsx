import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Aluno", detail: "Quem sera cobrado" },
  { title: "Categoria", detail: "Origem e valor" },
  { title: "Financeiro", detail: "Regras e envio" },
];

export function ChargeStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {STEPS.map((step, index) => {
        const active = index === currentStep;
        const done = index < currentStep;

        return (
          <div
            key={step.title}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-3 transition-all duration-300",
              active && "border-primary/45 bg-primary/10 shadow-[0_0_28px_rgba(255,69,0,0.12)]",
              done && "border-emerald-400/25 bg-emerald-500/10",
              !active && !done && "border-white/10 bg-white/[0.03]",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-black",
                  active && "border-primary/50 bg-primary text-primary-foreground",
                  done && "border-emerald-400/40 bg-emerald-500 text-black",
                  !active && !done && "border-white/10 bg-black/20 text-slate-400",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{step.title}</p>
                <p className="truncate text-xs text-slate-400">{step.detail}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
