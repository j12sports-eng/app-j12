const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CrmLeadEnrollmentConversionAuditService,
  EVENTS,
  fingerprintIdempotencyKey,
  normalizeAuditEvent,
} = require("../application/crm-lead-enrollment-conversion-audit.service.js");
const {
  CrmLeadEnrollmentConversionMetrics,
  METRIC_NAMES,
} = require("../application/crm-lead-enrollment-conversion-metrics.js");

class MemoryAuditAdapter {
  constructor({ fail = false } = {}) {
    this.fail = fail;
    this.records = [];
  }

  async record(record) {
    if (this.fail) throw new Error("audit adapter unavailable");
    this.records.push(record);
    return record;
  }
}

function silentLogger() {
  return { info() {}, warn() {}, error() {} };
}

test("audit service records start, success and failure with an allowlist", async () => {
  const adapter = new MemoryAuditAdapter();
  const metrics = new CrmLeadEnrollmentConversionMetrics();
  const service = new CrmLeadEnrollmentConversionAuditService({
    adapter,
    logger: silentLogger(),
    metrics,
  });

  await service.recordStart({
    leadId: "lead-1",
    unitId: "unit-1",
    userId: "user-1",
    correlationId: "corr-1",
  });
  await service.recordSuccess({
    correlationId: "corr-1",
    durationMs: 12,
    enrollmentId: "enrollment-1",
    enrollmentResolution: "CREATED",
    enrollmentReused: false,
    enrollmentStatus: "DRAFT",
    leadId: "lead-1",
    personId: "person-1",
    personProfileId: "profile-1",
    personResolution: "CREATED",
    personReused: false,
    profileResolution: "CREATED",
    profileReused: false,
    unitId: "unit-1",
    userId: "user-1",
  });
  await service.recordFailure({
    correlationId: "corr-2",
    durationMs: 4,
    errorCode: "CRM_ACCESS_DENIED",
    leadId: "lead-2",
    unitId: "unit-2",
    userId: "user-2",
  });

  assert.deepEqual(
    adapter.records.map((record) => record.eventType),
    [EVENTS.STARTED, EVENTS.SUCCEEDED, EVENTS.FAILED],
  );
  assert.equal(adapter.records[1].enrollmentStatus, "DRAFT");
  assert.equal(adapter.records[2].errorCode, "CRM_ACCESS_DENIED");
  assert.equal(adapter.records[2].errorCategory, "AUTHORIZATION");
  assert.equal("cpf" in adapter.records[1], false);
  assert.equal("nome" in adapter.records[1], false);
  assert.equal("email" in adapter.records[1], false);
  assert.equal("telefone" in adapter.records[1], false);
  assert.equal("body" in adapter.records[1], false);
  assert.equal("token" in adapter.records[1], false);
  const snapshot = metrics.snapshot();
  assert.ok(Object.keys(snapshot.counters).some((key) => key.includes(METRIC_NAMES.ATTEMPTS)));
  assert.ok(Object.keys(snapshot.counters).some((key) => key.includes(METRIC_NAMES.SUCCESS)));
  assert.ok(Object.keys(snapshot.counters).some((key) => key.includes(METRIC_NAMES.FAILURE)));
  assert.ok(Object.keys(snapshot.observations).some((key) => key.includes(METRIC_NAMES.DURATION)));
});

test("audit normalization rejects unknown fields, bounds values and hashes idempotency", () => {
  assert.throws(
    () => normalizeAuditEvent({ eventType: EVENTS.STARTED, cpf: "52998224725" }),
    /not allowed/i,
  );
  const record = normalizeAuditEvent({
    correlationId: "c".repeat(300),
    durationMs: -10,
    eventType: EVENTS.FAILED,
    errorCode: "not-a-real-code",
    errorCategory: "not-a-category",
    leadId: "lead-1",
  });
  assert.equal(record.correlationId.length, 128);
  assert.equal(record.durationMs, 0);
  assert.equal(record.errorCode, "UNKNOWN");
  assert.equal(record.errorCategory, "UNKNOWN");
  const fingerprint = fingerprintIdempotencyKey("request-secret", "lead-1");
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.notEqual(fingerprint, "request-secret");
});

test("audit adapter failures are fail-open and do not throw", async () => {
  const service = new CrmLeadEnrollmentConversionAuditService({
    adapter: new MemoryAuditAdapter({ fail: true }),
    logger: silentLogger(),
  });
  const result = await service.recordStart({ leadId: "lead-1" });
  assert.equal(result.eventType, EVENTS.STARTED);
});
