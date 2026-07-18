const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CrmLeadConversionHistoryExportController,
} = require("../controllers/crm-lead-conversion-history-export.controller.js");

function response() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("returns CSV headers and trusted context", async () => {
  let received;
  const controller = new CrmLeadConversionHistoryExportController({
    exportService: {
      async export(filters, context) {
        received = { filters, context };
        return {
          buffer: Buffer.from("csv"),
          contentType: "text/csv; charset=utf-8",
          filename: "crm-conversions-2026-07-18.csv",
          rows: 1,
        };
      },
    },
  });
  const res = response();
  await controller.export(
    {
      query: { leadId: "lead-1", unitId: "unit-1" },
      auth: { id: "user-1" },
      correlationId: "corr-1",
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Content-Type"], "text/csv; charset=utf-8");
  assert.match(res.headers["Content-Disposition"], /crm-conversions-2026-07-18\.csv/);
  assert.deepEqual(received.filters, { leadId: "lead-1", unitId: "unit-1" });
  assert.deepEqual(received.context, { correlationId: "corr-1", userId: "user-1" });
});

test("rejects unsupported query fields and sanitizes failures", async () => {
  const controller = new CrmLeadConversionHistoryExportController({
    exportService: {
      async export() {
        throw Object.assign(new Error("secret"), { code: "SQL", statusCode: 500 });
      },
    },
  });
  const invalid = response();
  await controller.export({ query: { cursor: "x" } }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.body.code, "CRM_EXPORT_INPUT_INVALID");
  const failed = response();
  await controller.export({ query: {} }, failed);
  assert.equal(failed.statusCode, 500);
  assert.equal(failed.body.code, "CRM_EXPORT_FAILED");
  assert.equal(JSON.stringify(failed.body).includes("secret"), false);
});
