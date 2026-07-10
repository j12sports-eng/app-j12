const assert = require("node:assert/strict");
const test = require("node:test");
const {
  exportFinancialReportCsv,
  exportFinancialReportPdf,
  exportFinancialReportXlsx,
} = require("../exporters/financial-report.exporters.js");

const report = {
  report: "financeiro",
  receitas: 100.5,
  saldo: 80.25,
  categorias: [{ categoria: "Mensalidade", valor: 100.5 }],
};

test("CSV export includes BOM, headers and report values", () => {
  const output = exportFinancialReportCsv(report);
  assert.equal(output.subarray(0, 3).toString("hex"), "efbbbf");
  assert.match(output.toString("utf8"), /Mensalidade/);
  assert.match(output.toString("utf8"), /100\.5/);
});

test("PDF export produces a PDF binary", () => {
  const output = exportFinancialReportPdf(report);
  assert.equal(output.subarray(0, 4).toString(), "%PDF");
  assert.ok(output.length > 500);
});

test("XLSX export produces an OOXML ZIP package", () => {
  const output = exportFinancialReportXlsx(report);
  assert.equal(output.subarray(0, 2).toString(), "PK");
  assert.ok(output.includes(Buffer.from("xl/worksheets/sheet1.xml")));
  assert.ok(output.includes(Buffer.from("Mensalidade")));
});

test("spreadsheet exports neutralize formula-like text", () => {
  const unsafe = { report: "financeiro", items: [{ categoria: "=CMD()" }] };
  assert.match(exportFinancialReportCsv(unsafe).toString("utf8"), /'=CMD\(\)/);
  assert.ok(exportFinancialReportXlsx(unsafe).includes(Buffer.from("'=CMD()")));
});
