const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CrmLeadConversionHistoryExportService,
  CRM_CONVERSION_HISTORY_EXPORT_MAX_ROWS,
  serializeCsv,
} = require("../application/crm-lead-conversion-history-export.service.js");

function row(id = "conversion-1") {
  return {
    id,
    leadId: "lead-1",
    unitId: "unit-1",
    personId: "person-1",
    personProfileId: "profile-1",
    enrollmentId: "enrollment-1",
    enrollmentStatus: "DRAFT",
    conversionStatus: "COMPLETED",
    convertedBy: "user-1",
    convertedAt: "2026-07-18T12:00:00.000Z",
  };
}

test("serializes a bounded allowlisted CSV", async () => {
  const calls = [];
  const service = new CrmLeadConversionHistoryExportService({
    repository: {
      async *iterateConversionHistoryForExport(filters, options) {
        calls.push({ filters, options });
        yield row();
      },
    },
    now: () => new Date("2026-07-18T00:00:00Z"),
    logger: { info() {} },
  });
  const result = await service.export(
    { leadId: "lead-1", dateFrom: "2026-07-01" },
    { userId: "u" },
  );
  const text = result.buffer.toString("utf8");
  assert.equal(result.filename, "crm-conversions-2026-07-18.csv");
  assert.equal(result.rows, 1);
  assert.equal(text.charCodeAt(0), 0xfeff);
  assert.equal(text.includes("conversionId"), true);
  assert.equal(text.includes("person-1"), true);
  assert.equal(text.includes("payload"), false);
  assert.equal(calls[0].filters.leadId, "lead-1");
  assert.equal(calls[0].options.maxRows, CRM_CONVERSION_HISTORY_EXPORT_MAX_ROWS + 1);
});

test("rejects pagination and sanitizes repository failures", async () => {
  const service = new CrmLeadConversionHistoryExportService({
    repository: { async *iterateConversionHistoryForExport() {} },
    logger: { info() {}, warn() {} },
  });
  await assert.rejects(() => service.export({ cursor: "bad" }), {
    code: "CRM_EXPORT_INPUT_INVALID",
  });
  const failed = new CrmLeadConversionHistoryExportService({
    repository: {
      async *iterateConversionHistoryForExport() {
        throw new Error("SQL PII");
      },
    },
    logger: { info() {}, warn() {} },
  });
  await assert.rejects(() => failed.export(), { code: "CRM_EXPORT_FAILED", statusCode: 500 });
});

test("neutralizes formulas and control characters", () => {
  const csv = serializeCsv([{ ...row("=danger"), convertedBy: "=cmd\n\tvalue" }]).toString("utf8");
  assert.match(csv, /'=danger/);
  assert.match(csv, /'=cmd\\n\\tvalue/);
});
