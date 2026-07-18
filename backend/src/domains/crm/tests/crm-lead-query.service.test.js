const assert = require("node:assert/strict");
const test = require("node:test");
const { CrmLeadQueryService, encodeCursor } = require("../application/crm-lead-query.service.js");

function row(overrides = {}) {
  return {
    created_at: "2026-07-18T10:00:00.000Z",
    id: "lead-1",
    stage: "WON",
    status: "CONVERTED",
    unit_id: "unit-1",
    updated_at: "2026-07-18T10:00:00.000Z",
    ...overrides,
  };
}

test("query service returns empty page with stable envelope", async () => {
  const service = new CrmLeadQueryService({
    repository: {
      async listLeadsForInternalQuery() {
        return [];
      },
      async findLeadDetailForInternalQuery() {},
    },
  });
  assert.deepEqual(await service.listLeads(), {
    items: [],
    pageInfo: { hasNextPage: false, nextCursor: null },
  });
});

test("query service applies default/max limit, cursor and maps eligibility/conversions", async () => {
  let received;
  const rows = [
    row(),
    row({
      id: "lead-2",
      created_at: "2026-07-17T10:00:00.000Z",
      student_conversion_status: "COMPLETED",
      student_person_id: "person-1",
      student_person_profile_id: "profile-1",
      student_converted_at: "2026-07-17T12:00:00.000Z",
    }),
    row({
      id: "lead-3",
      created_at: "2026-07-16T10:00:00.000Z",
      enrollment_conversion_status: "COMPLETED",
      enrollment_id: "enrollment-1",
      enrollment_status: "DRAFT",
    }),
  ];
  const service = new CrmLeadQueryService({
    repository: {
      async listLeadsForInternalQuery(filters) {
        received = filters;
        return rows;
      },
      async findLeadDetailForInternalQuery() {},
    },
  });
  const result = await service.listLeads({
    cursor: encodeCursor({ createdAt: "2026-07-19T10:00:00.000Z", id: "lead-9" }),
    limit: 2,
    stage: "WON",
    status: "CONVERTED",
    conversionStatus: "STUDENT_COMPLETED",
    unitId: "unit-1",
  });
  assert.equal(received.limit, 2);
  assert.equal(received.fetchLimit, 3);
  assert.deepEqual(received.cursor, { createdAt: "2026-07-19T10:00:00.000Z", id: "lead-9" });
  assert.equal(result.items.length, 2);
  assert.equal(result.pageInfo.hasNextPage, true);
  assert.equal(result.items[0].eligibility.canConvertToDraftEnrollment, true);
  assert.equal(result.items[1].conversions.studentCompleted, true);
  assert.equal(result.items[1].conversions.enrollmentCompleted, false);
  assert.equal(result.items[1].contact, undefined);
  assert.equal(result.pageInfo.nextCursor !== null, true);
});

test("eligibility distinguishes stage/status and completed enrollment", async () => {
  const service = new CrmLeadQueryService({
    repository: {
      async listLeadsForInternalQuery() {},
      async findLeadDetailForInternalQuery({ leadId }) {
        return {
          ...row({ id: leadId }),
          ...(leadId === "new"
            ? { stage: "NEW", status: "OPEN" }
            : {
                enrollment_conversion_status: "COMPLETED",
                enrollment_id: "enrollment-1",
                enrollment_status: "DRAFT",
              }),
        };
      },
    },
  });
  assert.equal(
    (await service.getLeadById({ leadId: "new" })).eligibility.reasonCode,
    "CRM_LEAD_NOT_WON",
  );
  const completed = await service.getLeadById({ leadId: "done" });
  assert.equal(completed.eligibility.canConvertToDraftEnrollment, false);
  assert.equal(completed.eligibility.reasonCode, "CRM_ENROLLMENT_ALREADY_CONVERTED");
});

test("detail exposes commercial contact only and never idempotency or raw metadata", async () => {
  const service = new CrmLeadQueryService({
    repository: {
      async listLeadsForInternalQuery() {},
      async findLeadDetailForInternalQuery() {
        return row({
          contact_name: "Contato",
          contact_email: "contato@example.com",
          contact_phone: "5511999999999",
          idempotency_key: "secret-key",
          metadata_json: "CPF 52998224725",
        });
      },
    },
  });
  const result = await service.getLeadById({ leadId: "lead-1" });
  assert.deepEqual(result.contact, {
    nome: "Contato",
    email: "contato@example.com",
    telefone: "5511999999999",
  });
  assert.equal(JSON.stringify(result).includes("idempotency"), false);
  assert.equal(JSON.stringify(result).includes("52998224725"), false);
});

test("invalid cursor/input and repository errors are deterministic and sanitized", async () => {
  const service = new CrmLeadQueryService({
    repository: {
      async listLeadsForInternalQuery() {
        throw new Error("SQL CPF 52998224725");
      },
      async findLeadDetailForInternalQuery() {},
    },
  });
  await assert.rejects(service.listLeads({ cursor: "invalid" }), {
    code: "CRM_CURSOR_INVALID",
    statusCode: 400,
  });
  await assert.rejects(service.listLeads({ limit: 101 }), {
    code: "CRM_INPUT_INVALID",
    statusCode: 400,
  });
  await assert.rejects(service.listLeads({ stage: "DROP TABLE" }), {
    code: "CRM_INPUT_INVALID",
    statusCode: 400,
  });
  await assert.rejects(
    service.listLeads(),
    (error) =>
      error.code === "CRM_LEAD_QUERY_FAILED" &&
      !error.message.includes("52998224725") &&
      error.details === null,
  );
});

test("missing detail is a sanitized 404", async () => {
  const service = new CrmLeadQueryService({
    repository: {
      async listLeadsForInternalQuery() {},
      async findLeadDetailForInternalQuery() {
        return null;
      },
    },
  });
  await assert.rejects(service.getLeadById({ leadId: "missing" }), {
    code: "CRM_LEAD_NOT_FOUND",
    statusCode: 404,
  });
});
