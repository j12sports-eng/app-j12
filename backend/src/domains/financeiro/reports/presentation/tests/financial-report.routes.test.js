const assert = require("node:assert/strict");
const test = require("node:test");
const { FinancialReportController } = require("../controllers/financial-report.controller.js");
const {
  FINANCIAL_REPORT_ROUTE_BASE_PATH,
  createFinancialReportRouter,
} = require("../routes/financial-report.routes.js");

test("FinancialReportRouter registers all requested administrative endpoints", () => {
  const controller = Object.fromEntries(
    [
      "getAll",
      "getFinancial",
      "getInstallments",
      "getDelinquency",
      "getPix",
      "getAutomations",
      "exportPdf",
      "exportXlsx",
      "exportCsv",
    ].map((key) => [key, () => {}]),
  );
  const router = createFinancialReportRouter({
    authMiddleware: pass,
    accessMiddleware: pass,
    controller,
  });
  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ methods: Object.keys(layer.route.methods), path: layer.route.path }));

  assert.equal(FINANCIAL_REPORT_ROUTE_BASE_PATH, "/admin/financeiro/relatorios");
  assert.deepEqual(routes, [
    { methods: ["get"], path: "/" },
    { methods: ["get"], path: "/financeiro" },
    { methods: ["get"], path: "/mensalidades" },
    { methods: ["get"], path: "/inadimplencia" },
    { methods: ["get"], path: "/pix" },
    { methods: ["get"], path: "/automacoes" },
    { methods: ["get"], path: "/export/pdf" },
    { methods: ["get"], path: "/export/xlsx" },
    { methods: ["get"], path: "/export/csv" },
  ]);
});

test("FinancialReportController delegates JSON and binary responses", async () => {
  const calls = [];
  const controller = new FinancialReportController({
    service: {
      async export(input, format) {
        calls.push(["export", input, format]);
        return { buffer: Buffer.from("mock"), contentType: "text/csv", filename: "report.csv" };
      },
      async getConsolidated(input) {
        calls.push(["all", input]);
        return { report: "all" };
      },
    },
  });
  const jsonResponse = response();
  await controller.getAll({ query: { unidade: "Centro" } }, jsonResponse, noNext);
  const exportResponse = response();
  await controller.exportCsv({ query: { report: "financeiro" } }, exportResponse, noNext);

  assert.deepEqual(jsonResponse.body, { data: { report: "all" }, success: true });
  assert.equal(exportResponse.headers["Content-Type"], "text/csv");
  assert.equal(exportResponse.sent.toString(), "mock");
  assert.deepEqual(calls, [
    ["all", { unidade: "Centro" }],
    ["export", { report: "financeiro" }, "csv"],
  ]);
});

function pass(_req, _res, next) {
  next();
}
function noNext(error) {
  if (error) throw error;
}
function response() {
  return {
    body: null,
    headers: {},
    sent: null,
    statusCode: 200,
    json(value) {
      this.body = value;
      return this;
    },
    send(value) {
      this.sent = value;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
  };
}
