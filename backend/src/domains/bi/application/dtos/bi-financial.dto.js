function createBiFinancialDto({ analytics, filters, generatedAt }) {
  const current = analytics.current || {};
  const previous = analytics.previous || {};
  const payingStudents = numeric(current.payingStudents);
  const previousPayingStudents = numeric(previous.payingStudents);

  return Object.freeze({
    breakdowns: Object.freeze({
      categories: rows(analytics.categories, "category"),
      modalities: rows(analytics.modalities, "modality"),
      paymentMethods: rows(analytics.paymentMethods, "paymentMethod"),
      units: rows(analytics.units, "unit"),
    }),
    contractVersion: "21.3",
    evolution: Object.freeze(
      (analytics.evolution || []).map((row) =>
        Object.freeze({
          period: text(row.period),
          receivedRevenue: money(row.receivedRevenue),
        }),
      ),
    ),
    filters,
    generatedAt,
    kpis: Object.freeze({
      averageTicket: derivedMoney(
        payingStudents > 0 ? money(current.receivedRevenue) / payingStudents : null,
        previousPayingStudents > 0
          ? money(previous.receivedRevenue) / previousPayingStudents
          : null,
        "NO_PAYING_STUDENTS",
      ),
      expenses: moneyMetric(current.expenses, previous.expenses),
      expectedRevenue: moneyMetric(current.expectedRevenue, previous.expectedRevenue),
      overdueRevenue: moneyMetric(current.overdueRevenue, previous.overdueRevenue),
      pendingRevenue: moneyMetric(current.pendingRevenue, previous.pendingRevenue),
      receivedRevenue: moneyMetric(current.receivedRevenue, previous.receivedRevenue),
    }),
    readOnly: true,
  });
}

function moneyMetric(value, previousValue) {
  const current = money(value);
  const previous = money(previousValue);
  return Object.freeze({
    available: true,
    comparison: comparison(current, previous),
    reason: null,
    unit: "currency",
    value: current,
  });
}

function derivedMoney(value, previousValue, reason) {
  if (value === null) return unavailableMetric(reason);
  const current = money(value);
  return Object.freeze({
    available: true,
    comparison:
      previousValue === null
        ? unavailableComparison(reason)
        : comparison(current, money(previousValue)),
    reason: null,
    unit: "currency",
    value: current,
  });
}

function comparison(current, previous) {
  if (previous === 0) return unavailableComparison("PREVIOUS_VALUE_ZERO", previous);
  const percent = Number((((current - previous) / Math.abs(previous)) * 100).toFixed(2));
  return Object.freeze({
    available: true,
    percent,
    previousValue: previous,
    reason: null,
    trend: percent > 0 ? "positive" : percent < 0 ? "negative" : "neutral",
  });
}

function unavailableMetric(reason) {
  return Object.freeze({
    available: false,
    comparison: unavailableComparison(reason),
    reason,
    unit: "currency",
    value: null,
  });
}

function unavailableComparison(reason, previousValue = null) {
  return Object.freeze({
    available: false,
    percent: null,
    previousValue,
    reason,
    trend: "unavailable",
  });
}

function rows(values, key) {
  return Object.freeze(
    (values || []).map((row) =>
      Object.freeze({
        key: text(row[key]) || "nao_informado",
        quantity: Math.trunc(numeric(row.quantity)),
        value: money(row.value),
      }),
    ),
  );
}

function money(value) {
  return Number(numeric(value).toFixed(2));
}
function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function text(value) {
  return value == null ? "" : String(value);
}

module.exports = { createBiFinancialDto };
