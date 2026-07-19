const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CrmLeadSlaAlertMetrics,
  METRIC_NAMES,
  normalizeLabels,
} = require("../application/crm-lead-sla-alert-metrics.js");

test("metrics aggregate bounded counters and non-negative durations", () => {
  const metrics = new CrmLeadSlaAlertMetrics();
  const labels = { result: "SUCCEEDED", source: "INTERNAL_CRM" };
  assert.equal(metrics.increment(METRIC_NAMES.SUCCESS, labels), 1);
  assert.equal(metrics.increment(METRIC_NAMES.SUCCESS, labels, 2), 3);
  assert.deepEqual(metrics.observe(METRIC_NAMES.DURATION, 12.9, labels), {
    count: 1,
    max: 12,
    sum: 12,
  });
  assert.equal(metrics.observe(METRIC_NAMES.DURATION, -1, labels), null);
});

test("metrics discard high-cardinality labels and collapse excess series", () => {
  assert.deepEqual(
    normalizeLabels({ alertStatus: "OVERDUE", leadId: "lead-sensitive", userId: "user-1" }),
    { alertStatus: "OVERDUE" },
  );
  const metrics = new CrmLeadSlaAlertMetrics({ maxSeries: 1 });
  metrics.increment(METRIC_NAMES.ITEMS, { alertStatus: "OVERDUE", stage: "NEW" });
  metrics.increment(METRIC_NAMES.ITEMS, { alertStatus: "WARNING", stage: "CONTACTED" });
  const serialized = JSON.stringify(metrics.snapshot());
  assert.equal(serialized.includes("lead-sensitive"), false);
  assert.equal(Object.keys(metrics.snapshot().counters).length, 2);
  assert.equal(
    Object.keys(metrics.snapshot().counters).some((key) => key.endsWith("|{}")),
    true,
  );
});
