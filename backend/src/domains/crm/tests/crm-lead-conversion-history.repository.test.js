const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MySqlCrmLeadConversionHistoryRepository,
  buildConversionHistoryQuery,
} = require("../infrastructure/mysql-crm-lead-conversion-history.repository.js");

test("history repository uses one restricted parameterized query without joins or PII", async () => {
  const calls = [];
  const repository = new MySqlCrmLeadConversionHistoryRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return [[]];
    },
  });

  await repository.listConversionHistory({
    convertedBy: "admin-1",
    cursor: { convertedAt: "2026-07-18T20:00:00.000Z", id: "conversion-1" },
    dateFrom: "2026-07-01T00:00:00.000Z",
    dateTo: "2026-07-18T23:59:59.999Z",
    enrollmentStatus: "DRAFT",
    fetchLimit: 51,
    leadId: "lead-1",
    unitId: "unit-1",
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /^SELECT ec\.id,ec\.lead_id,ec\.unit_id/);
  assert.match(calls[0].sql, /ORDER BY ec\.converted_at DESC,ec\.id DESC LIMIT \?$/);
  assert.match(calls[0].sql, /ec\.converted_at<\? OR \(ec\.converted_at=\? AND ec\.id<\?\)/);
  assert.equal(calls[0].params.at(-1), 51);
  assert.deepEqual(calls[0].params.slice(0, 5), [
    "COMPLETED",
    "lead-1",
    "unit-1",
    "admin-1",
    "DRAFT",
  ]);
  assert.doesNotMatch(
    calls[0].sql,
    /SELECT \*|JOIN|people|enrollments|idempotency|metadata|contact|cpf|email|phone/i,
  );
});

test("history repository enforces its fetch limit even when called directly", () => {
  const query = buildConversionHistoryQuery({ fetchLimit: 999 });
  assert.equal(query.params.at(-1), 101);
});

test("history detail is one restricted query and maps database fields", async () => {
  const calls = [];
  const repository = new MySqlCrmLeadConversionHistoryRepository({
    queryRunner: async (sql, params) => {
      calls.push({ sql, params });
      return [
        [
          {
            id: "conversion-1",
            lead_id: "lead-1",
            unit_id: "unit-1",
            person_id: "person-1",
            person_profile_id: "profile-1",
            enrollment_id: "enrollment-1",
            enrollment_status: "DRAFT",
            status: "COMPLETED",
            converted_by: "admin-1",
            converted_at: new Date("2026-07-18T20:00:00.000Z"),
          },
        ],
      ];
    },
  });

  const result = await repository.findConversionHistoryById("conversion-1");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ["conversion-1", "COMPLETED"]);
  assert.match(calls[0].sql, /WHERE ec\.id=\? AND ec\.status=\? LIMIT 1/);
  assert.equal(result.enrollmentId, "enrollment-1");
  assert.equal(result.convertedAt, "2026-07-18T20:00:00.000Z");
});

test("history repository propagates infrastructure errors for service sanitization", async () => {
  const failure = Object.assign(new Error("database unavailable"), { code: "ECONNREFUSED" });
  const repository = new MySqlCrmLeadConversionHistoryRepository({
    queryRunner: async () => {
      throw failure;
    },
  });
  await assert.rejects(repository.listConversionHistory(), (error) => error === failure);
  await assert.rejects(
    repository.findConversionHistoryById("conversion-1"),
    (error) => error === failure,
  );
});
