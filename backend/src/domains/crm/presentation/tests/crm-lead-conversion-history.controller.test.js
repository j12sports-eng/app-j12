const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CrmLeadConversionHistoryController,
  readFilters,
} = require("../controllers/crm-lead-conversion-history.controller.js");

function response() {
  return {
    body: null,
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test("history controller list validates query and returns the standard envelope", async () => {
  let received;
  const controller = new CrmLeadConversionHistoryController({
    queryService: {
      async listConversions(filters) {
        received = filters;
        return { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
      },
      async getConversionById() {},
    },
  });
  const res = response();
  await controller.list(
    { query: { enrollmentStatus: "DRAFT", leadId: "lead-1", limit: "10" } },
    res,
    assert.fail,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(received.leadId, "lead-1");
  assert.equal(received.enrollmentStatus, "DRAFT");
});

test("history controller detail validates id, rejects query and forwards service errors", async () => {
  let received;
  const controller = new CrmLeadConversionHistoryController({
    queryService: {
      async listConversions() {},
      async getConversionById(id) {
        received = id;
        return { id };
      },
    },
  });
  const res = response();
  await controller.getById(
    { params: { conversionId: "conversion-1" }, query: {} },
    res,
    assert.fail,
  );
  assert.equal(received, "conversion-1");
  assert.deepEqual(res.body, { success: true, data: { id: "conversion-1" } });

  let forwarded;
  await controller.getById(
    { params: { conversionId: "bad/id" }, query: {} },
    response(),
    (error) => {
      forwarded = error;
    },
  );
  assert.equal(forwarded.code, "CRM_INPUT_INVALID");
});

test("history controller rejects unsupported or ambiguous filters", () => {
  assert.throws(() => readFilters({ resolution: "CREATED" }), { code: "CRM_INPUT_INVALID" });
  assert.throws(() => readFilters({ reused: "true" }), { code: "CRM_INPUT_INVALID" });
  assert.throws(() => readFilters({ limit: ["1", "2"] }), { code: "CRM_INPUT_INVALID" });
  assert.throws(() => readFilters(Object.create({ limit: "1" })), {
    code: "CRM_INPUT_INVALID",
  });
});

test("history controller has no repository dependency", () => {
  const source = require("node:fs").readFileSync(
    require.resolve("../controllers/crm-lead-conversion-history.controller.js"),
    "utf8",
  );
  assert.equal(source.includes("repository"), false);
});
