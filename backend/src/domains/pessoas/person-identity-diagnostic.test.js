const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  DUPLICATE_PROFILES_SQL,
  IDENTITY_ISSUE_TYPES,
  IDENTITY_SEVERITIES,
  PEOPLE_IDENTITY_PAGE_SQL,
  PersonIdentityDiagnosticReadRepository,
  PersonIdentityDiagnosticService,
  analyzeIdentityDataset,
  createReadOnlyQueryRunner,
  runPersonIdentityDiagnostic,
} = require("./person-identity-diagnostic.js");

function syntheticPeople() {
  return [
    {
      id: "person-1",
      cpf: "012.345.678-90",
      email: " Family+Kids@Example.COM ",
      telefone: "(11) 99999-9999",
      celular: null,
    },
    {
      id: "person-2",
      cpf: "01234567890",
      email: "family+kids@example.com",
      telefone: "11999999999",
      celular: "+55 11 98888-7777",
    },
    {
      id: "person-3",
      cpf: "invalid-cpf",
      email: "invalid-email",
      telefone: "11 RAMAL 2",
      celular: "+55 11 98888-7777",
    },
    { id: "person-4", cpf: null, email: null, telefone: null, celular: null },
  ];
}

test("diagnostic classifies normalized CPF duplicate as critical", () => {
  const report = analyzeIdentityDataset(syntheticPeople());
  const issue = report.safeIssues.find(
    (item) => item.issueType === IDENTITY_ISSUE_TYPES.DUPLICATE_STRONG_IDENTIFIER,
  );
  assert.deepEqual(issue.personIds, ["person-1", "person-2"]);
  assert.equal(issue.field, "cpf");
  assert.equal(issue.severity, IDENTITY_SEVERITIES.CRITICAL);
  assert.equal(report.metrics.duplicateCpfGroups, 1);
  assert.equal(report.metrics.peopleInDuplicateCpfGroups, 2);
});

test("shared e-mail and phones remain contacts rather than strong duplicates", () => {
  const report = analyzeIdentityDataset(syntheticPeople());
  const shared = report.safeIssues.filter(
    (item) => item.issueType === IDENTITY_ISSUE_TYPES.SHARED_CONTACT,
  );
  assert.ok(shared.some((item) => item.field === "email"));
  assert.ok(shared.some((item) => item.field === "phone"));
  assert.ok(shared.every((item) => item.severity === IDENTITY_SEVERITIES.LOW));
  assert.equal(
    shared.some((item) => item.issueType === IDENTITY_ISSUE_TYPES.DUPLICATE_STRONG_IDENTIFIER),
    false,
  );
  assert.equal(report.metrics.sharedEmailGroups, 1);
  assert.equal(report.metrics.sharedPhoneGroups, 2);
});

test("format variations, international phone and incomplete identity are aggregated", () => {
  const report = analyzeIdentityDataset(syntheticPeople());
  assert.ok(
    report.safeIssues.some((item) => item.issueType === IDENTITY_ISSUE_TYPES.FORMAT_VARIATION),
  );
  assert.ok(
    report.safeIssues.some((item) => item.issueType === IDENTITY_ISSUE_TYPES.INCOMPLETE_IDENTITY),
  );
  assert.equal(report.metrics.cpfNormalizable, 2);
  assert.equal(report.metrics.cpfInvalid, 1);
  assert.equal(report.metrics.cpfAbsent, 1);
  assert.equal(report.metrics.phoneNormalizable, 4);
  assert.equal(report.metrics.peopleWithoutStrongIdentifier, 2);
});

test("legacy compatibility metrics distinguish mapper-only and truncation risk", () => {
  const report = analyzeIdentityDataset([
    { id: "legacy-1", cpf: 12345678900, email: "bad", telefone: { number: "11" } },
    { id: "legacy-2", cpf: "12345678900", email: `${"a".repeat(191)}@x.io`, telefone: null },
  ]);
  assert.equal(report.metrics.mapperOnlyRecords, 2);
  assert.equal(report.metrics.mapperTruncationRiskRecords, 1);
  assert.ok(report.metrics.normalizerIncompatibleValues >= 3);
  assert.ok(report.safeIssues.every((item) => !JSON.stringify(item).includes("@x.io")));
});

test("safe report preserves only internal ids and contains no source PII", () => {
  const records = syntheticPeople();
  const report = analyzeIdentityDataset(records, { generatedAt: "2026-07-18T00:00:00.000Z" });
  const json = JSON.stringify(report);
  assert.match(json, /person-1/);
  assert.doesNotMatch(json, /01234567890|Family|example\.com|999999999|988887777/i);
  assert.equal(report.generatedAt, "2026-07-18T00:00:00.000Z");
  assert.ok(Object.isFrozen(report));
  assert.deepEqual(analyzeIdentityDataset(records), analyzeIdentityDataset(records));
});

test("empty dataset is deterministic and finite", () => {
  const report = analyzeIdentityDataset([]);
  assert.equal(report.metrics.totalPeople, 0);
  assert.deepEqual(report.safeIssues, []);
  assert.equal(JSON.stringify(report).includes("NaN"), false);
  assert.equal(JSON.stringify(report).includes("Infinity"), false);
});

test("dataset processing enforces a hard record limit", () => {
  assert.throws(
    () => analyzeIdentityDataset(syntheticPeople(), { maxRecords: 3 }),
    /exceeds maxRecords/,
  );
  assert.throws(() => analyzeIdentityDataset([], { maxRecords: 0 }), /maxRecords/);
});

test("read-only repository paginates by id cursor and bounded batches", async () => {
  const calls = [];
  const pages = [
    [
      { id: "p1", cpf: null },
      { id: "p2", cpf: null },
    ],
    [{ id: "p3", cpf: null }],
  ];
  const repository = new PersonIdentityDiagnosticReadRepository({
    queryRunner: async (sql, params) => {
      calls.push({ params, sql });
      return pages.shift() ?? [];
    },
  });
  const result = [];
  for await (const page of repository.iteratePeople({ batchSize: 2, maxRecords: 10 }))
    result.push(...page);
  assert.deepEqual(
    result.map((item) => item.id),
    ["p1", "p2", "p3"],
  );
  assert.deepEqual(
    calls.map((call) => call.params),
    [
      ["", 2],
      ["p2", 2],
    ],
  );
  assert.ok(calls.every((call) => call.sql === PEOPLE_IDENTITY_PAGE_SQL));
  assert.doesNotMatch(calls[0].sql, /OFFSET/i);
});

test("profile diagnostic is aggregate, limited and contains no personal fields", async () => {
  const repository = new PersonIdentityDiagnosticReadRepository({
    queryRunner: async (sql, params) => {
      assert.equal(sql, DUPLICATE_PROFILES_SQL);
      assert.deepEqual(params, [5]);
      return [
        {
          person_id: "p1",
          profile_type: "aluno",
          profile_count: 2,
          active_count: 2,
          status_count: 1,
        },
      ];
    },
  });
  const rows = await repository.findDuplicateProfiles({ limit: 5 });
  assert.deepEqual(rows, [
    { activeCount: 2, personId: "p1", profileCount: 2, profileType: "aluno", statusCount: 1 },
  ]);
  assert.doesNotMatch(JSON.stringify(rows), /cpf|email|telefone|nome/i);
});

test("service processes repository batches and includes duplicate profiles", async () => {
  const repository = {
    async *iteratePeople(options) {
      assert.deepEqual(options, { batchSize: 2, maxRecords: 10 });
      yield syntheticPeople().slice(0, 2);
      yield syntheticPeople().slice(2);
    },
    async findDuplicateProfiles() {
      return [
        {
          activeCount: 2,
          personId: "person-1",
          profileCount: 2,
          profileType: "aluno",
          statusCount: 1,
        },
      ];
    },
  };
  const service = new PersonIdentityDiagnosticService({
    clock: () => new Date("2026-07-18T00:00:00Z"),
  });
  const report = await service.analyzeRepository(repository, { batchSize: 2, maxRecords: 10 });
  assert.equal(report.metrics.batchesProcessed, 2);
  assert.equal(report.metrics.duplicateProfileGroups, 1);
  assert.equal(report.profileIssues[0].severity, IDENTITY_SEVERITIES.HIGH);
});

test("repository errors propagate and close runs after success or failure", async () => {
  for (const shouldFail of [false, true]) {
    let closed = 0;
    const repository = {
      async *iteratePeople() {
        if (shouldFail) throw new Error("synthetic repository failure");
        yield [];
      },
    };
    const service = new PersonIdentityDiagnosticService({ clock: () => new Date(0) });
    const execution = runPersonIdentityDiagnostic({
      close: async () => {
        closed += 1;
      },
      repository,
      service,
    });
    if (shouldFail) await assert.rejects(execution, /synthetic repository failure/);
    else await execution;
    assert.equal(closed, 1);
  }
});

test("read-only guard rejects every non-SELECT statement", async () => {
  const calls = [];
  const query = createReadOnlyQueryRunner(async (sql) => {
    calls.push(sql);
    return [];
  });
  await query("SELECT id FROM people");
  for (const sql of [
    "UPDATE people SET cpf = NULL",
    "DELETE FROM people",
    "SHOW INDEX FROM people",
    "SELECT 1; DROP TABLE people",
  ]) {
    await assert.rejects(() => query(sql), /SELECT only/);
  }
  assert.deepEqual(calls, ["SELECT id FROM people"]);
});

test("batch and report parameters reject invalid values", async () => {
  const repository = new PersonIdentityDiagnosticReadRepository({ queryRunner: async () => [] });
  await assert.rejects(async () => {
    for await (const _page of repository.iteratePeople({ batchSize: 0 })) void _page;
  }, /batchSize/);
  assert.throws(() => new PersonIdentityDiagnosticService({ maxIssueGroups: 0 }), /maxIssueGroups/);
});
