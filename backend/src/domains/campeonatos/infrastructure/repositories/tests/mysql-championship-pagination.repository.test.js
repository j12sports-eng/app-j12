const assert = require("node:assert/strict");
const test = require("node:test");

const { MySqlChampionshipPublicRepository } = require("../mysql-championship-public.repository.js");
const { MySqlChampionshipRepository } = require("../mysql-championship.repository.js");

test("admin championship list emits a normalized literal LIMIT for MySQL 8.4", async () => {
  const calls = [];
  const repository = new MySqlChampionshipRepository({
    async queryRunner(sql, params = []) {
      calls.push({ params, sql });
      return [];
    },
  });

  await repository.findAll({ limit: "25", search: "e2e" });

  const listCall = calls.at(-1);
  assert.match(listCall.sql, /LIMIT 25\s*$/);
  assert.doesNotMatch(listCall.sql, /LIMIT \?/);
  assert.deepEqual(listCall.params, ["%e2e%", "%e2e%", "%e2e%"]);
});

test("public championship list emits normalized literal pagination for MySQL 8.4", async () => {
  const calls = [];
  const noSchemaWork = { async ensureSchema() {} };
  const repository = new MySqlChampionshipPublicRepository({
    championshipSchemaRepository: noSchemaWork,
    groupSchemaRepository: noSchemaWork,
    registrationSchemaRepository: noSchemaWork,
    async queryRunner(sql, params = []) {
      calls.push({ params, sql });
      return sql.includes("COUNT(*)") ? [{ total: 0 }] : [];
    },
  });

  await repository.findPublishedAll({ limit: "20", page: "3" });

  const listCall = calls.at(-1);
  assert.match(listCall.sql, /LIMIT 20\s+OFFSET 40\s*$/);
  assert.doesNotMatch(listCall.sql, /(?:LIMIT|OFFSET) \?/);
  assert.deepEqual(listCall.params, ["PUBLISHED"]);
});
