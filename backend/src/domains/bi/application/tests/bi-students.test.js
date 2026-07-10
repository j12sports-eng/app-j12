const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BiStudentsService } = require("../index.js");
test("student BI separates unique students from enrollments and compares entries", async () => {
  let received;
  const service = new BiStudentsService({
    now: () => new Date("2026-07-10T12:00:00Z"),
    repository: {
      async getStudentAnalytics(input) {
        received = input;
        return analytics();
      },
    },
  });
  const result = await service.getAnalytics({
    period: "CUSTOM",
    startDate: "2026-07-01",
    endDate: "2026-07-10",
    unitId: "4",
  });
  assert.equal(result.kpis.activeStudents.value, 8);
  assert.equal(result.kpis.activeEnrollments.value, 11);
  assert.equal(result.kpis.newStudents.value, 3);
  assert.equal(result.kpis.newEnrollments.value, 5);
  assert.equal(result.kpis.newStudents.comparison.percent, 50);
  assert.equal(received.previous.unitId, "4");
});
test("unsupported exit and transfer metrics remain explicit and never become artificial zero", async () => {
  const { kpis } = await serviceWith({}).getAnalytics();
  for (const key of [
    "cancellations",
    "netGrowth",
    "retentionRate",
    "churnRate",
    "averageTenureDays",
    "transfers",
  ]) {
    assert.equal(kpis[key].available, false);
    assert.equal(kpis[key].value, null);
    assert.ok(kpis[key].reason);
  }
});
test("student BI handles previous zero and empty distributions", async () => {
  const result = await serviceWith({
    current: { newStudents: 2, newEnrollments: 2 },
    previous: { newStudents: 0, newEnrollments: 0 },
  }).getAnalytics();
  assert.equal(result.kpis.newStudents.comparison.available, false);
  assert.equal(result.kpis.newStudents.comparison.reason, "PREVIOUS_VALUE_ZERO");
  assert.deepEqual(result.distributions.ageGroups, []);
});
test("student BI validates period, clock and repository", async () => {
  await assert.rejects(() => serviceWith({}).getAnalytics({ period: "CUSTOM" }), {
    code: "BI_PERIOD_INVALID",
  });
  await assert.rejects(
    () =>
      new BiStudentsService({
        now: () => "bad",
        repository: { getStudentAnalytics() {} },
      }).getAnalytics(),
    { code: "BI_CLOCK_INVALID" },
  );
  await assert.rejects(() => new BiStudentsService({ repository: {} }).getAnalytics(), {
    code: "BI_REPOSITORY_INVALID",
  });
});
test("student BI payload never exposes individual personal fields", async () => {
  const payload = await serviceWith(analytics()).getAnalytics();
  const serialized = JSON.stringify(payload);
  for (const field of [
    "nome",
    "cpf",
    "rg",
    "telefone",
    "email",
    "endereco",
    "data_nascimento",
    "dataNascimento",
  ]) {
    assert.equal(serialized.includes(field), false);
  }
});
function serviceWith(data) {
  return new BiStudentsService({
    now: () => new Date("2026-07-10T12:00:00Z"),
    repository: {
      async getStudentAnalytics() {
        return data;
      },
    },
  });
}
function analytics() {
  return {
    ageGroups: [{ key: "12-17", value: 4 }],
    current: { activeEnrollments: 11, activeStudents: 8, newEnrollments: 5, newStudents: 3 },
    evolution: [{ newEnrollments: 5, newStudents: 3, period: "2026-07" }],
    modalities: [{ key: "futsal", value: 6 }],
    previous: { newEnrollments: 3, newStudents: 2 },
    units: [{ key: "centro", value: 8 }],
  };
}
