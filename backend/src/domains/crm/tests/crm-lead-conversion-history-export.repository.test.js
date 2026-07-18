const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MySqlCrmLeadConversionHistoryRepository,
} = require("../infrastructure/mysql-crm-lead-conversion-history.repository.js");

test("iterates export history with bounded pages and keyset cursor", async () => {
  const queries = [];
  const repository = new MySqlCrmLeadConversionHistoryRepository({
    queryRunner: async (sql, params) => {
      queries.push({ sql, params });
      const page =
        queries.length === 1
          ? [
              { id: "2", converted_at: "2026-07-18T12:00:00Z", status: "COMPLETED" },
              { id: "1", converted_at: "2026-07-18T11:00:00Z", status: "COMPLETED" },
            ]
          : [{ id: "0", converted_at: "2026-07-18T10:00:00Z", status: "COMPLETED" }];
      return [page];
    },
  });
  const result = [];
  for await (const item of repository.iterateConversionHistoryForExport(
    {},
    { batchSize: 1, maxRows: 3 },
  ))
    result.push(item.id);
  assert.deepEqual(result, ["2", "1", "0"]);
  assert.equal(queries.length, 2);
  assert.match(queries[1].sql, /converted_at<\?/);
  assert.equal(queries[0].params.at(-1), 2);
});
