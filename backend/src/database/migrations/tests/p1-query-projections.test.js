const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../../../..");
const FILES = [
  "services/student-finance.js",
  "src/domains/financeiro/automation/infrastructure/repositories/mysql-financial-automation.repository.js",
  "src/domains/financeiro/payment/infrastructure/repositories/mysql-payment.repository.js",
  "src/domains/financeiro/infrastructure/repositories/mysql-automation-execution-history.repository.js",
  "src/domains/financeiro/infrastructure/repositories/mysql-enrollment-financial-bridge.repository.js",
  "src/domains/financeiro/infrastructure/repositories/mysql-enrollment-financial-obligation.repository.js",
  "src/domains/quadras/application/services/court-rental.service.js",
  "src/domains/campeonatos/infrastructure/repositories/mysql-championship.repository.js",
  "src/domains/campeonatos/infrastructure/repositories/mysql-championship-public.repository.js",
  "src/domains/campeonatos/infrastructure/repositories/mysql-championship-registration.repository.js",
  "src/domains/campeonatos/infrastructure/repositories/mysql-championship-statistics.repository.js",
];

test("P1 repository batch uses explicit projections without changing Inter", () => {
  for (const relativePath of FILES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    assert.doesNotMatch(source, /SELECT\s+\*/i, relativePath);
  }
  assert.ok(FILES.every((file) => !file.includes("/inter/")));
});
