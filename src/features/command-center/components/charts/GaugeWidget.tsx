import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export function GaugeWidget({
  color = "#ff4500",
  label,
  max = 100,
  value,
}: {
  color?: string;
  label: string;
  max?: number;
  value: number;
}) {
  const safeValue = Math.min(max, Math.max(0, value));
  const remaining = Math.max(0, max - safeValue);

  return (
    <div className="relative h-48" aria-label={`${label}: ${safeValue} de ${max}`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={[
              { name: label, value: safeValue },
              { name: "Restante", value: remaining },
            ]}
            dataKey="value"
            endAngle={0}
            innerRadius={62}
            outerRadius={82}
            startAngle={180}
          >
            <Cell fill={color} />
            <Cell fill="rgba(255,255,255,0.08)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-x-0 bottom-5 text-center">
        <strong className="text-3xl font-black text-white">{safeValue}%</strong>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      </div>
    </div>
  );
}
