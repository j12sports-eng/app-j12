const { SharedConstants } = require("../../../../core/shared/shared-constants.js");

const DEFAULT_TIMEZONE = SharedConstants.DEFAULT_TIMEZONE;

const BiPeriod = Object.freeze({
  TODAY: "TODAY",
  LAST_7_DAYS: "LAST_7_DAYS",
  LAST_30_DAYS: "LAST_30_DAYS",
  CURRENT_MONTH: "CURRENT_MONTH",
  PREVIOUS_MONTH: "PREVIOUS_MONTH",
  CURRENT_QUARTER: "CURRENT_QUARTER",
  CURRENT_YEAR: "CURRENT_YEAR",
  CUSTOM: "CUSTOM",
});

const BI_DATE_FORMAT = "YYYY-MM-DD";

function resolveBiPeriod(input = {}, options = {}) {
  const timezone = normalizeTimezone(options.timezone || DEFAULT_TIMEZONE);
  const today = calendarDate(options.now || new Date(), timezone);
  const startDateInput = input.startDate ?? input.dateFrom;
  const endDateInput = input.endDate ?? input.dateTo;
  const hasCustomDates = Boolean(startDateInput || endDateInput);
  const period = String(input.period || (hasCustomDates ? BiPeriod.CUSTOM : BiPeriod.CURRENT_MONTH))
    .trim()
    .toUpperCase();

  if (!Object.values(BiPeriod).includes(period)) throw invalidPeriod("period");
  if (period === BiPeriod.CUSTOM) {
    const startDate = normalizeDate(startDateInput, "startDate");
    const endDate = normalizeDate(endDateInput, "endDate");
    if (startDate > endDate) throw invalidPeriod("dateRange");
    return freezePeriod({ endDate, period, startDate, timezone });
  }

  const current = parseCalendarDate(today);
  let startDate = today;
  let endDate = today;
  if (period === BiPeriod.LAST_7_DAYS) startDate = addDays(today, -6);
  if (period === BiPeriod.LAST_30_DAYS) startDate = addDays(today, -29);
  if (period === BiPeriod.CURRENT_MONTH) startDate = formatDate(current.year, current.month, 1);
  if (period === BiPeriod.PREVIOUS_MONTH) {
    const previous = addMonths(current.year, current.month, -1);
    startDate = formatDate(previous.year, previous.month, 1);
    endDate = formatDate(previous.year, previous.month, daysInMonth(previous.year, previous.month));
  }
  if (period === BiPeriod.CURRENT_QUARTER) {
    const quarterMonth = Math.floor((current.month - 1) / 3) * 3 + 1;
    startDate = formatDate(current.year, quarterMonth, 1);
  }
  if (period === BiPeriod.CURRENT_YEAR) startDate = formatDate(current.year, 1, 1);
  return freezePeriod({ endDate, period, startDate, timezone });
}

function calendarDate(value, timezone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw invalidPeriod("now");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type) => parts.find((part) => part.type === type)?.value;
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function normalizeTimezone(value) {
  const timezone = String(value || "").trim();
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format(new Date());
  } catch {
    throw invalidPeriod("timezone");
  }
  return timezone;
}

function normalizeDate(value, field) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw invalidPeriod(field);
  const parsed = parseCalendarDate(text);
  if (
    parsed.month < 1 ||
    parsed.month > 12 ||
    parsed.day < 1 ||
    parsed.day > daysInMonth(parsed.year, parsed.month) ||
    formatDate(parsed.year, parsed.month, parsed.day) !== text
  ) {
    throw invalidPeriod(field);
  }
  return text;
}

function parseCalendarDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function addDays(value, amount) {
  const { year, month, day } = parseCalendarDate(value);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function addMonths(year, month, amount) {
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDate(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function freezePeriod(value) {
  return Object.freeze({ ...value, inclusive: Object.freeze({ endDate: true, startDate: true }) });
}

function invalidPeriod(field) {
  return Object.assign(new TypeError(`BI period ${field} is invalid.`), {
    code: "BI_PERIOD_INVALID",
    details: { field },
  });
}

module.exports = { BI_DATE_FORMAT, BiPeriod, resolveBiPeriod };
