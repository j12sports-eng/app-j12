export function formatPercent(value: number | null | undefined, maximumFractionDigits = 2) {
  return `${(value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits })}%`;
}
