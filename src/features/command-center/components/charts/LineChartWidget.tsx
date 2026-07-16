import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartWidgetTooltip } from "./ChartWidgetTooltip";
import type { BaseChartWidgetProps } from "./chart-widget.types";

export function LineChartWidget({
  data,
  emptyMessage = "Nenhum dado disponível.",
  height = 280,
  series,
  xKey,
}: BaseChartWidgetProps) {
  if (!data.length) return <ChartEmpty message={emptyMessage} height={height} />;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} width={38} />
          <Tooltip content={<ChartWidgetTooltip />} />
          {series.map((item) => (
            <Line
              key={item.dataKey}
              dataKey={item.dataKey}
              name={item.label}
              stroke={item.color}
              strokeWidth={3}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartEmpty({ height, message }: { height: number; message: string }) {
  return (
    <div
      className="grid place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-400"
      style={{ height }}
    >
      {message}
    </div>
  );
}
