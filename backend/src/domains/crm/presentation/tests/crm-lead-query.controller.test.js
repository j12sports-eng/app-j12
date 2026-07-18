const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CrmLeadQueryController,
  readFilters,
} = require("../controllers/crm-lead-query.controller.js");

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

test("controller list validates query, calls service and returns envelope", async () => {
  let received;
  const controller = new CrmLeadQueryController({
    queryService: {
      async listLeads(filters) {
        received = filters;
        return { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
      },
      async getLeadById() {},
    },
  });
  const res = response();
  await controller.list(
    { query: { limit: "10", stage: "WON", unitId: "unit-1" } },
    res,
    assert.fail,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(received, {
    conversionStatus: null,
    cursor: null,
    limit: "10",
    stage: "WON",
    status: null,
    unitId: "unit-1",
  });
});

test("controller detail validates id and forwards service errors", async () => {
  let received;
  const controller = new CrmLeadQueryController({
    queryService: {
      async listLeads() {},
      async getLeadById(input) {
        received = input;
        return { id: input.leadId };
      },
    },
  });
  const res = response();
  await controller.getById(
    { params: { leadId: "lead-1" }, query: { unitId: "unit-1" } },
    res,
    assert.fail,
  );
  assert.deepEqual(received, { leadId: "lead-1", unitId: "unit-1" });
  assert.deepEqual(res.body, { success: true, data: { id: "lead-1" } });

  let forwarded;
  const failing = new CrmLeadQueryController({
    queryService: {
      async listLeads() {
        throw Object.assign(new Error("bad"), { code: "CRM_CURSOR_INVALID", statusCode: 400 });
      },
      async getLeadById() {},
    },
  });
  await failing.list({ query: {} }, response(), (error) => {
    forwarded = error;
  });
  assert.equal(forwarded.code, "CRM_CURSOR_INVALID");
});

test("controller rejects unknown, array and prototype-polluted query values", () => {
  assert.throws(() => readFilters({ search: "x" }), { code: "CRM_INPUT_INVALID" });
  assert.throws(() => readFilters({ limit: ["1", "2"] }), { code: "CRM_INPUT_INVALID" });
  assert.throws(() => readFilters(Object.create({ limit: "1" })), { code: "CRM_INPUT_INVALID" });
});

test("controller module has no repository import", () => {
  const source = require("node:fs").readFileSync(
    require.resolve("../controllers/crm-lead-query.controller.js"),
    "utf8",
  );
  assert.equal(source.includes("repository"), false);
});
