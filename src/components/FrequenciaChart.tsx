import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type Props = {
  presentes: number;
  faltas: number;
};

export default function FrequenciaChart({ presentes, faltas }: Props) {
  const data = [
    {
      name: "Presentes",
      value: presentes,
    },

    {
      name: "Faltas",
      value: faltas,
    },
  ];

  const COLORS = ["#22c55e", "#ef4444"];

  return (
    <div
      className="
        bg-zinc-900
        rounded-2xl
        p-6
        h-[350px]
      "
    >
      <h2
        className="
          text-2xl
          text-white
          mb-6
        "
      >
        Frequência
      </h2>

      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={100} dataKey="value" label>
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index]} />
            ))}
          </Pie>

          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
