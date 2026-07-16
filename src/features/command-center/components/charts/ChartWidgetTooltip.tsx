type TooltipPayload = {
  color?: string;
  name?: string;
  value?: number | string;
};

export function ChartWidgetTooltip({
  active,
  label,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipPayload[];
  valueFormatter?: (value: number | string) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/90 p-3 text-sm shadow-2xl">
      {label ? <p className="mb-2 font-black text-white">{label}</p> : null}
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={`${entry.name}-${index}`} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <strong className="text-white">
              {valueFormatter && entry.value !== undefined
                ? valueFormatter(entry.value)
                : entry.value}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
