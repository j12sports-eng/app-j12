const assert = require("node:assert/strict");
const { test } = require("node:test");
const { MySqlBiExecutiveRepository } = require("./mysql-bi-executive.repository.js");

test("repository uses exactly two parameterized aggregate reads without N+1", async () => {
  const calls = [];
  const repository = new MySqlBiExecutiveRepository({
    async queryRunner(sql, params) {
      calls.push({ sql, params });
      return [[{}]];
    },
  });
  const result = await repository.getExecutiveSnapshot({
    current: period("2026-07-01", "2026-07-10", "3"),
    previous: period("2026-06-21", "2026-06-30", "3"),
  });
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every(
      ({ sql }) => /COUNT\(|SUM\(/.test(sql) && !/\b(?:INSERT|UPDATE|DELETE)\b/i.test(sql),
    ),
  );
  assert.ok(calls.every(({ params }) => params.length > 0));
  assert.equal(result.current.receivedRevenue, 0);
  assert.equal(result.previous.newStudents, 0);
});

test("repository normalizes mysql rows, decimals and NULL aggregates", async () => {
  let call = 0;
  const repository = new MySqlBiExecutiveRepository({
    async queryRunner() {
      call += 1;
      return call === 1
        ? [[{ active_students: "8", new_students: null, previous_new_students: "2" }]]
        : [
            [
              {
                expected_revenue: "100.50",
                overdue_revenue: null,
                paying_students: "2",
                received_revenue: "80.25",
                previous_expected_revenue: "50",
                previous_overdue_revenue: "5",
                previous_paying_students: "1",
                previous_received_revenue: "40",
              },
            ],
          ];
    },
  });
  const result = await repository.getExecutiveSnapshot({
    current: period("2026-07-01", "2026-07-10"),
    previous: period("2026-06-21", "2026-06-30"),
  });
  assert.deepEqual(result.current, {
    activeStudents: 8,
    expectedRevenue: 100.5,
    newStudents: 0,
    overdueRevenue: 0,
    payingStudents: 2,
    receivedRevenue: 80.25,
  });
});

function period(startDate, endDate, unitId = null) {
  return { startDate, endDate, unitId };
}
