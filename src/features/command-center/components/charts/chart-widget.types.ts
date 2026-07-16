export type ChartDatum = Record<string, string | number>;

export type ChartSeries = {
  color: string;
  dataKey: string;
  label: string;
};

export type BaseChartWidgetProps = {
  data: ChartDatum[];
  emptyMessage?: string;
  height?: number;
  series: ChartSeries[];
  xKey: string;
};
