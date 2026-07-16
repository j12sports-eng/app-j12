import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartWidgetTooltip } from "./ChartWidgetTooltip";
import type { BaseChartWidgetProps } from "./chart-widget.types";

export function BarChartWidget({ data, height = 280, series, xKey }: BaseChartWidgetProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} width={38} />
          <Tooltip content={<ChartWidgetTooltip />} />
          {series.map((item) => (
            <Bar
              key={item.dataKey}
              dataKey={item.dataKey}
              fill={item.color}
              name={item.label}
              radius={[8, 8, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
