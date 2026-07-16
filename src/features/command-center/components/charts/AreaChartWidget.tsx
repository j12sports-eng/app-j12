import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartWidgetTooltip } from "./ChartWidgetTooltip";
import type { BaseChartWidgetProps } from "./chart-widget.types";

export function AreaChartWidget({ data, height = 280, series, xKey }: BaseChartWidgetProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} width={38} />
          <Tooltip content={<ChartWidgetTooltip />} />
          {series.map((item) => (
            <Area
              key={item.dataKey}
              dataKey={item.dataKey}
              fill={item.color}
              fillOpacity={0.16}
              name={item.label}
              stroke={item.color}
              strokeWidth={3}
              type="monotone"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
