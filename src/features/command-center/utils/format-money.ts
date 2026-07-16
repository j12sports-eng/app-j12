const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

export function formatMoney(value: number | null | undefined) {
  return moneyFormatter.format(value ?? 0);
}
