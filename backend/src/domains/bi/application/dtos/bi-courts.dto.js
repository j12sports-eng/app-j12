const ACTIVE = new Set(["confirmed", "completed"]);
const CANCELLED = new Set(["cancelled", "canceled"]);
const ACTIVE_COURTS = new Set(["ativa"]);
const WEEKDAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const REVENUE_UNAVAILABLE_REASON = "NO_CANONICAL_PAYMENT_AMOUNT_AND_TIMESTAMP";
function createBiCourtsDto({ analytics = {}, filters, generatedAt }) {
  const from = `${filters.current.startDate}T00:00:00-03:00`,
    to = `${filters.current.endDate}T23:59:59.999-03:00`;
  const courts = (analytics.courts || [])
    .map(court)
    .filter((item) => ACTIVE_COURTS.has(item.status));
  const reservations = (analytics.reservations || []).map(reservation);
  const active = reservations.filter((r) => ACTIVE.has(r.status));
  const cancelled = reservations.filter((r) => CANCELLED.has(r.status));
  const availableMinutes = courts.reduce(
    (sum, c) => sum + availability(c, filters.current.startDate, filters.current.endDate),
    0,
  );
  const reservedMinutes = mergedMinutes(active, from, to);
  const byCourt = courts.map((c) => {
    const items = active.filter((r) => r.courtId === c.id);
    const minutes = mergedMinutes(items, from, to);
    return Object.freeze({
      availableHours: round(
        availability(c, filters.current.startDate, filters.current.endDate) / 60,
      ),
      courtId: c.id,
      courtName: c.name,
      occupancyRate:
        availability(c, filters.current.startDate, filters.current.endDate) > 0
          ? round(
              (minutes / availability(c, filters.current.startDate, filters.current.endDate)) * 100,
            )
          : null,
      reservedHours: round(minutes / 60),
      revenue: null,
      unit: c.unit,
    });
  });
  return Object.freeze({
    contractVersion: "21.7",
    filters,
    generatedAt,
    kpis: Object.freeze({
      availableHours: metric(round(availableMinutes / 60), "hours"),
      cancellations: metric(cancelled.length, "count"),
      occupancyRate:
        availableMinutes > 0
          ? metric(round((reservedMinutes / availableMinutes) * 100), "percentage")
          : unavailable("percentage", "NO_CANONICAL_AVAILABILITY"),
      rentalRevenue: unavailable("currency", REVENUE_UNAVAILABLE_REASON),
      reservedHours: metric(round(reservedMinutes / 60), "hours"),
      ticketAverage: unavailable("currency", REVENUE_UNAVAILABLE_REASON),
    }),
    readOnly: true,
    rankings: Object.freeze({
      courts: Object.freeze(byCourt),
      days: Object.freeze(group(active, (r) => weekday(r.startAt))),
      hours: Object.freeze(group(active, (r) => r.startAt.slice(11, 16))),
      units: Object.freeze(group(active, (r) => r.unit)),
    }),
  });
}
function availability(c, start, end) {
  let total = 0;
  for (const date of dates(start, end)) {
    const key = WEEKDAY_KEYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
    for (const w of c.schedule[key] || []) total += Math.max(minutes(w.end) - minutes(w.start), 0);
  }
  return total;
}
function mergedMinutes(items, from, to) {
  const start = Date.parse(from),
    end = Date.parse(to);
  const grouped = new Map();
  for (const r of items) {
    const a = Math.max(Date.parse(sqlDate(r.startAt)), start),
      b = Math.min(Date.parse(sqlDate(r.endAt)), end);
    if (b <= a) continue;
    const list = grouped.get(r.courtId) || [];
    list.push([a, b]);
    grouped.set(r.courtId, list);
  }
  let total = 0;
  for (const list of grouped.values()) {
    list.sort((a, b) => a[0] - b[0]);
    let [s, e] = list[0] || [0, 0];
    for (const [a, b] of list.slice(1)) {
      if (a <= e) e = Math.max(e, b);
      else {
        total += e - s;
        [s, e] = [a, b];
      }
    }
    total += e - s;
  }
  return total / 60000;
}
function court(r) {
  let schedule = {};
  try {
    schedule = JSON.parse(r.funcionamento_json || "{}") || {};
  } catch {}
  return {
    id: String(r.id),
    name: String(r.nome || "Quadra"),
    schedule,
    status: String(r.status || ""),
    unit: String(r.unidade || "nao_informado"),
  };
}
function reservation(r) {
  return {
    courtId: String(r.quadra_id),
    endAt: String(r.end_at),
    financialChargeId: r.financial_charge_id || null,
    id: String(r.id),
    paymentStatus: String(r.payment_status || "").toLowerCase(),
    recurrenceGroupId: r.recurrence_group_id || null,
    startAt: String(r.start_at),
    status: String(r.status || "").toLowerCase(),
    unit: String(r.unidade || "nao_informado"),
    value: number(r.final_value),
  };
}
function group(items, keyFn) {
  const m = new Map();
  for (const r of items) {
    const key = keyFn(r) || "nao_informado";
    const v = m.get(key) || { key, reservations: 0, reservedHours: 0, revenue: 0 };
    v.reservations++;
    v.reservedHours += Math.max(
      (Date.parse(sqlDate(r.endAt)) - Date.parse(sqlDate(r.startAt))) / 3600000,
      0,
    );
    m.set(key, v);
  }
  return [...m.values()].map((v) =>
    Object.freeze({ ...v, reservedHours: round(v.reservedHours), revenue: null }),
  );
}
function dates(a, b) {
  const out = [];
  for (
    let d = new Date(`${a}T12:00:00Z`), e = new Date(`${b}T12:00:00Z`);
    d <= e;
    d.setUTCDate(d.getUTCDate() + 1)
  )
    out.push(d.toISOString().slice(0, 10));
  return out;
}
function sqlDate(v) {
  return /Z|[+-]\d\d:\d\d$/.test(v) ? v : v.replace(" ", "T") + "-03:00";
}
function minutes(v) {
  const [h, m] = String(v || "")
    .split(":")
    .map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
}
function weekday(v) {
  const date = String(v).replace(" ", "T").slice(0, 10);
  return WEEKDAY_KEYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
}
function sum(a, k) {
  return a.reduce((s, v) => s + number(v[k]), 0);
}
function number(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function round(v) {
  return Number(number(v).toFixed(2));
}
function metric(value, unit) {
  return Object.freeze({ available: true, reason: null, unit, value });
}
function unavailable(unit, reason) {
  return Object.freeze({ available: false, reason, unit, value: null });
}
module.exports = { createBiCourtsDto };
