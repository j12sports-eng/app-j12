import { cn } from "@/lib/utils";

export type LegendItem = {
  color: string;
  id: string;
  label: string;
  value?: string;
};

export function Legend({ className, items }: { className?: string; items: LegendItem[] }) {
  return (
    <ul className={cn("flex flex-wrap gap-3", className)} aria-label="Legenda">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2 text-xs text-slate-300">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
          {item.value ? <strong className="text-white">{item.value}</strong> : null}
        </li>
      ))}
    </ul>
  );
}
