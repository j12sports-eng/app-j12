function createBiDelinquencyDto({ analytics = {}, filters, generatedAt }) {
  const k = analytics.kpis || {};
  const overdue = money(k.overdue_value);
  const eligible = money(k.eligible_value);
  const recovered = money(k.recovered_value);
  return Object.freeze({
    aging: list(analytics.aging, "bucket"),
    contractVersion: "21.6",
    evolution: list(analytics.evolution, "period"),
    filters,
    generatedAt,
    kpis: Object.freeze({
      delinquencyRate:
        eligible > 0
          ? metric(percent(overdue, eligible), "percentage")
          : unavailable("percentage", "NO_ELIGIBLE_PORTFOLIO"),
      overdueObligations: metric(count(k.overdue_obligations), "count"),
      overdueValue: metric(overdue, "currency"),
      recoveredObligations: metric(count(k.recovered_obligations), "count"),
      recoveredValue: metric(recovered, "currency"),
      recoveryRate:
        overdue + recovered > 0
          ? metric(percent(recovered, overdue + recovered), "percentage")
          : unavailable("percentage", "NO_LATE_OBLIGATIONS"),
      uniqueDebtors: metric(count(k.unique_debtors), "count"),
    }),
    readOnly: true,
    statuses: list(analytics.statuses, "status"),
  });
}
function list(values, key) {
  return Object.freeze(
    (values || []).map((row) =>
      Object.freeze({
        key: String(row[key] || "nao_informado"),
        quantity: count(row.quantity),
        value: money(row.value),
      }),
    ),
  );
}
function metric(value, unit) {
  return Object.freeze({ available: true, reason: null, unit, value });
}
function unavailable(unit, reason) {
  return Object.freeze({ available: false, reason, unit, value: null });
}
function percent(a, b) {
  return Number(((a / b) * 100).toFixed(2));
}
function count(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}
function money(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : 0;
}
module.exports = { createBiDelinquencyDto };
