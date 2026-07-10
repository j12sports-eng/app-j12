const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiExportService, REPORT_METHODS } = require("../index.js");

test("BI export delegates all reports to the dashboard services with unchanged filters", async () => {
  const calls = [];
  const services = Object.fromEntries(
    Object.entries(REPORT_METHODS).map(([report, method]) => [
      report,
      { [method]: async (filters) => (calls.push({ filters, method, report }), dashboard()) },
    ]),
  );
  const service = new BiExportService({
    now: () => new Date("2026-07-10T12:00:00Z"),
    services,
  });
  const filters = { period: "LAST_30_DAYS", unitId: "unidade-1" };
  for (const report of Object.keys(REPORT_METHODS))
    await service.export({ format: "csv", query: filters, report });
  assert.equal(calls.length, 7);
  assert.ok(calls.every((call) => call.filters === filters));
  assert.deepEqual(
    calls.map(({ method, report }) => ({ method, report })),
    Object.entries(REPORT_METHODS).map(([report, method]) => ({ method, report })),
  );
});

test("BI export supports CSV, XLSX and PDF with custom dashboard filters", async () => {
  const calls = [];
  const service = createService(async (filters) => (calls.push(filters), dashboard()));
  const query = {
    endDate: "2026-07-31",
    period: "CUSTOM",
    startDate: "2026-07-01",
    unitId: "1",
  };
  for (const format of ["csv", "xlsx", "pdf"]) {
    const file = await service.export({ format, query, report: "executive" });
    assert.ok(Buffer.isBuffer(file.buffer));
    assert.match(file.filename, new RegExp(`^j12-bi-executive-2026-07-10\\.${format}$`));
  }
  assert.equal(calls.length, 3);
  assert.equal(calls[0], query);
});

test("CSV and XLSX neutralize all formula prefixes and preserve special characters", async () => {
  const service = createService(async () => ({
    rankings: [
      {
        at: "@SUM(A1:A2)",
        formula: "=SUM(A1:A2)",
        minus: "-10+20",
        name: 'Acao, "Norte"\nLinha 2',
        plus: "+cmd",
      },
    ],
  }));
  for (const format of ["csv", "xlsx"]) {
    const file = await service.export({ format, report: "executive" });
    const text = file.buffer.toString("utf8");
    for (const value of ["'=SUM(A1:A2)", "'+cmd", "'-10+20", "'@SUM(A1:A2)"])
      assert.ok(text.includes(value));
    assert.match(text, /Acao/);
    assert.match(text, /Linha 2/);
  }
});

test("PDF exports every approved logical row without the financial 300-row preview", async () => {
  const items = Array.from({ length: 301 }, (_, index) => ({ index, value: `linha-${index}` }));
  const service = createService(async () => ({ items }));
  const file = await service.export({ format: "pdf", report: "executive" });
  assert.equal(file.rows, 302);
  assert.equal(file.buffer.subarray(0, 4).toString(), "%PDF");
  assert.match(file.buffer.toString("latin1"), /linha-300/);
});

test("BI export rejects invalid options, excess rows and timeout", async () => {
  const service = createService(async () => ({ items: [{ id: 1 }, { id: 2 }] }), { maxRows: 1 });
  await assert.rejects(
    service.export({ format: "csv", report: "executive" }),
    (error) =>
      error.code === "BI_EXPORT_LIMIT_EXCEEDED" && error.details.rows > error.details.limit,
  );
  await assert.rejects(
    service.export({ format: "exe", report: "executive" }),
    (error) => error.code === "BI_EXPORT_FORMAT_INVALID",
  );
  await assert.rejects(
    service.export({ format: "csv", report: "people" }),
    (error) => error.code === "BI_EXPORT_REPORT_INVALID",
  );
  const slow = createService(() => new Promise(() => {}), { timeoutMs: 5 });
  await assert.rejects(
    slow.export({ format: "csv", report: "executive" }),
    (error) => error.code === "BI_EXPORT_TIMEOUT",
  );
});

test("BI export preserves unavailable metrics and original service errors", async () => {
  const unavailable = createService(async () => ({
    kpis: { revenue: { available: false, reason: "fonte_indisponivel", value: null } },
  }));
  const file = await unavailable.export({ format: "csv", report: "executive" });
  assert.match(file.buffer.toString("utf8"), /fonte_indisponivel/);
  const original = Object.assign(new Error("repository unavailable"), { code: "DB_DOWN" });
  const failing = createService(async () => {
    throw original;
  });
  await assert.rejects(failing.export({ format: "csv", report: "executive" }), original);
});

test("BI export clears its timeout timer after successful completion", async () => {
  const originalClearTimeout = global.clearTimeout;
  let cleared = false;
  global.clearTimeout = (timer) => {
    cleared = true;
    return originalClearTimeout(timer);
  };
  try {
    await createService(async () => dashboard()).export({ format: "csv", report: "executive" });
    assert.equal(cleared, true);
  } finally {
    global.clearTimeout = originalClearTimeout;
  }
});

function createService(getDashboard, options = {}) {
  return new BiExportService({
    ...options,
    now: () => new Date("2026-07-10T12:00:00Z"),
    services: { executive: { getDashboard } },
  });
}
function dashboard() {
  return {
    filters: { current: { timezone: "America/Sao_Paulo" } },
    generatedAt: "2026-07-10T12:00:00.000Z",
    kpis: { revenue: { available: true, unit: "currency", value: 1234.5 } },
  };
}
