import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartWidgetTooltip } from "./ChartWidgetTooltip";
import { Legend } from "../shared";

export type PieChartItem = {
  color: string;
  id: string;
  label: string;
  value: number;
};

export function PieChartWidget({ data, height = 240 }: { data: PieChartItem[]; height?: number }) {
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={52}
              nameKey="label"
              outerRadius={78}
              paddingAngle={4}
            >
              {data.map((item) => (
                <Cell key={item.id} fill={item.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartWidgetTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <Legend
        items={data.map((item) => ({
          color: item.color,
          id: item.id,
          label: item.label,
          value: item.value.toLocaleString("pt-BR"),
        }))}
      />
    </div>
  );
}
