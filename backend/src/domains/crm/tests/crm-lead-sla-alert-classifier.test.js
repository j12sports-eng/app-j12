const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CRM_LEAD_SLA_ALERT_STATUS,
  CrmLeadSlaAlertClassifier,
} = require("../domain/crm-lead-sla-alert-classifier.js");
const { CrmLeadStageSlaPolicy } = require("../domain/crm-lead-stage-sla-policy.js");

test("classifier maps only canonical SLA results to operational statuses", () => {
  const classifier = new CrmLeadSlaAlertClassifier();
  assert.equal(classifier.classify("OVERDUE"), CRM_LEAD_SLA_ALERT_STATUS.OVERDUE);
  assert.equal(classifier.classify("DUE_SOON"), CRM_LEAD_SLA_ALERT_STATUS.WARNING);
  assert.equal(classifier.classify("NOT_CONFIGURED"), CRM_LEAD_SLA_ALERT_STATUS.NOT_CONFIGURED);
  assert.equal(classifier.classify("UNAVAILABLE"), CRM_LEAD_SLA_ALERT_STATUS.UNAVAILABLE);
  assert.equal(classifier.classify("ON_TRACK"), CRM_LEAD_SLA_ALERT_STATUS.NORMAL);
  assert.equal(classifier.classify("COMPLETED"), CRM_LEAD_SLA_ALERT_STATUS.COMPLETED);
});

test("classifier never invents a result for an unknown SLA status", () => {
  const classifier = new CrmLeadSlaAlertClassifier();
  assert.equal(classifier.classify("UNKNOWN"), null);
  assert.equal(classifier.classify(null), null);
});

test("unknown Lead stage remains UNAVAILABLE through the canonical policy", () => {
  const policy = new CrmLeadStageSlaPolicy({ limitsMs: { NEW: 1_000 } });
  const sla = policy.evaluate({
    elapsedMs: 500,
    historyCoverage: "COMPLETE",
    stage: "UNKNOWN",
  });
  assert.equal(sla.status, "UNAVAILABLE");
  assert.equal(new CrmLeadSlaAlertClassifier().classify(sla.status), "UNAVAILABLE");
});
