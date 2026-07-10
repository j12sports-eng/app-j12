const assert = require("node:assert/strict");
const test = require("node:test");

const {
  BiFoundationService,
  BiPeriod,
  BiReadRepositoryCapability,
  createBiFoundationDto,
  normalizeBiQuery,
  resolveBiPeriod,
} = require("../index.js");

const NOW = new Date("2026-07-10T15:00:00.000Z");

test("BI periods resolve deterministically in the canonical timezone", () => {
  assert.deepEqual(resolveBiPeriod({ period: "TODAY" }, { now: NOW }), {
    endDate: "2026-07-10",
    inclusive: { endDate: true, startDate: true },
    period: "TODAY",
    startDate: "2026-07-10",
    timezone: "America/Sao_Paulo",
  });
  assert.equal(resolveBiPeriod({ period: "LAST_7_DAYS" }, { now: NOW }).startDate, "2026-07-04");
  assert.equal(resolveBiPeriod({ period: "CURRENT_MONTH" }, { now: NOW }).startDate, "2026-07-01");
  assert.equal(resolveBiPeriod({ period: "PREVIOUS_MONTH" }, { now: NOW }).endDate, "2026-06-30");
});

test("BI custom period validates dates and inverted intervals", () => {
  const period = resolveBiPeriod(
    { endDate: "2026-07-10", period: "CUSTOM", startDate: "2026-07-01" },
    { now: NOW },
  );
  assert.equal(period.startDate, "2026-07-01");
  assert.throws(() => resolveBiPeriod({ period: "UNKNOWN" }, { now: NOW }), {
    code: "BI_PERIOD_INVALID",
  });
  assert.throws(
    () => resolveBiPeriod({ endDate: "2026-07-10", period: "CUSTOM", startDate: "2026-02-30" }),
    { code: "BI_PERIOD_INVALID" },
  );
  assert.throws(
    () => resolveBiPeriod({ endDate: "2026-07-01", period: "CUSTOM", startDate: "2026-07-10" }),
    { code: "BI_PERIOD_INVALID" },
  );
  assert.throws(() => resolveBiPeriod({ period: "CUSTOM", startDate: "2026-07-01" }), {
    code: "BI_PERIOD_INVALID",
  });
});

test("BI query accepts only foundation filters and validates unitId", () => {
  const query = normalizeBiQuery({ period: "TODAY", unitId: "unit-1" }, { now: NOW });
  assert.equal(query.unitId, "unit-1");
  assert.equal("page" in query, false);
  assert.equal("granularity" in query, false);
  assert.throws(() => normalizeBiQuery({ unitId: "x".repeat(65) }, { now: NOW }), {
    code: "BI_FILTER_INVALID",
  });
});

test("BI foundation DTO and service expose the audited executive capability", () => {
  const service = new BiFoundationService({ now: NOW });
  const result = service.describe({ period: BiPeriod.CURRENT_MONTH });
  assert.deepEqual(result.capabilities, { foundation: true, metrics: true, reports: false });
  assert.equal(result.contractVersion, "21.1");
  assert.equal(result.timezone, "America/Sao_Paulo");
  assert.deepEqual(result.repository, BiReadRepositoryCapability);
  assert.deepEqual(result.filters.supported, ["period", "startDate", "endDate", "unitId"]);
  assert.equal("metrics" in result.filters.applied, false);
  assert.equal(Object.isFrozen(createBiFoundationDto(result.filters.applied)), true);
});
