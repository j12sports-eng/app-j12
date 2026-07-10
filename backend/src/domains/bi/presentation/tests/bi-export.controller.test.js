const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiExportController } = require("../controllers/bi-export.controller.js");

test("BI export controller sends a safe CSV attachment and complete headers", async () => {
  const controller = new BiExportController({
    service: {
      async export(input) {
        assert.deepEqual(input, {
          format: "csv",
          query: { period: "CURRENT_MONTH" },
          report: "financial",
        });
        return {
          buffer: Buffer.from("file"),
          contentType: "text/csv; charset=utf-8",
          filename: "j12-bi-financial-2026-07-10.csv",
          rows: 4,
        };
      },
    },
  });
  const res = response();
  await controller.export(
    { params: { format: "csv", report: "financial" }, query: { period: "CURRENT_MONTH" } },
    res,
    noNext,
  );
  assert.equal(
    res.headers["Content-Disposition"],
    'attachment; filename="j12-bi-financial-2026-07-10.csv"',
  );
  assert.equal(res.headers["Content-Type"], "text/csv; charset=utf-8");
  assert.equal(res.headers["Content-Length"], "4");
  assert.equal(res.headers["X-BI-Export-Rows"], "4");
  assert.equal(res.body.toString(), "file");
});

test("BI export controller sends XLSX and PDF binary content types", async () => {
  for (const [format, contentType] of [
    ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["pdf", "application/pdf"],
  ]) {
    const controller = new BiExportController({
      service: {
        async export() {
          return { buffer: Buffer.from(format), contentType, filename: `safe.${format}`, rows: 1 };
        },
      },
    });
    const res = response();
    await controller.export({ params: { format, report: "executive" } }, res, noNext);
    assert.equal(res.headers["Content-Type"], contentType);
    assert.ok(Buffer.isBuffer(res.body));
  }
});

test("BI export controller maps controlled client, limit and timeout errors", async () => {
  for (const [code, status] of [
    ["BI_EXPORT_FORMAT_INVALID", 400],
    ["BI_EXPORT_REPORT_INVALID", 400],
    ["BI_FILTER_INVALID", 400],
    ["BI_PERIOD_INVALID", 400],
    ["BI_EXPORT_LIMIT_EXCEEDED", 413],
    ["BI_EXPORT_TIMEOUT", 504],
  ]) {
    const controller = new BiExportController({
      service: {
        async export() {
          throw Object.assign(new Error(code), { code, details: { limit: 1 } });
        },
      },
    });
    const res = response();
    await controller.export({ params: {}, query: {} }, res, noNext);
    assert.equal(res.statusCode, status);
  }
});

test("BI export controller forwards unexpected errors to the global handler", async () => {
  const unexpected = new Error("unexpected");
  const controller = new BiExportController({
    service: {
      async export() {
        throw unexpected;
      },
    },
  });
  let forwarded;
  await controller.export({ params: {}, query: {} }, response(), (error) => {
    forwarded = error;
  });
  assert.equal(forwarded, unexpected);
});

function noNext(error) {
  if (error) throw error;
}
function response() {
  return {
    body: null,
    headers: {},
    statusCode: 200,
    json(value) {
      this.body = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
  };
}
