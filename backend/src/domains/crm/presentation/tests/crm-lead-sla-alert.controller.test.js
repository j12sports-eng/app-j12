const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const test = require("node:test");

const {
  CrmLeadSlaAlertController,
  readFilters,
} = require("../controllers/crm-lead-sla-alert.controller.js");

function response() {
  return {
    body: null,
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("controller validates the allowlist, forwards trusted context and returns the standard envelope", async () => {
  let received;
  const controller = new CrmLeadSlaAlertController({
    queryService: {
      async listSlaAlerts(filters, context) {
        received = { context, filters };
        return { items: [], nextCursor: null };
      },
    },
  });
  const res = response();
  await controller.list(
    {
      auth: { id: "admin-1" },
      correlationId: "corr-1",
      query: { limit: "10", slaStatus: "WARNING", stage: "NEW", unitId: "unit-1" },
    },
    res,
    assert.fail,
  );
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, data: { items: [], nextCursor: null } });
  assert.deepEqual(received, {
    context: { correlationId: "corr-1", userId: "admin-1" },
    filters: {
      cursor: null,
      limit: "10",
      slaStatus: "WARNING",
      stage: "NEW",
      unitId: "unit-1",
    },
  });
});

test("controller rejects unknown fields, responsibleId, arrays and polluted prototypes", () => {
  assert.throws(() => readFilters({ search: "x" }), { code: "CRM_INPUT_INVALID" });
  assert.throws(() => readFilters({ responsibleId: "operator-1" }), {
    code: "CRM_INPUT_INVALID",
  });
  assert.throws(() => readFilters({ stage: ["NEW"] }), { code: "CRM_INPUT_INVALID" });
  assert.throws(() => readFilters(Object.create({ limit: "1" })), {
    code: "CRM_INPUT_INVALID",
  });
  assert.throws(() => readFilters({ limit: "" }), { code: "CRM_INPUT_INVALID" });
});

test("controller forwards service errors and imports no repository or SLA policy", async () => {
  const source = await readFile(
    require.resolve("../controllers/crm-lead-sla-alert.controller.js"),
    "utf8",
  );
  assert.equal(/repository/i.test(source), false);
  assert.equal(/sla-policy/i.test(source), false);

  const expected = Object.assign(new Error("failed"), {
    code: "CRM_SLA_ALERT_QUERY_FAILED",
    statusCode: 500,
  });
  const controller = new CrmLeadSlaAlertController({
    queryService: {
      async listSlaAlerts() {
        throw expected;
      },
    },
  });
  let forwarded;
  await controller.list({ auth: {}, query: {} }, response(), (error) => {
    forwarded = error;
  });
  assert.equal(forwarded, expected);
});
