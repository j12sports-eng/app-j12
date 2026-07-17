const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  BI_AGENDA_EXCEPTIONS_SQL,
  BI_AGENDA_SERIES_SQL,
  MySqlBiAgendaRepository,
  exceptionParams,
  seriesParams,
} = require("./mysql-bi-agenda.repository.js");

test("Agenda repository performs exactly two parallel parameterized aggregate reads", async () => {
  const calls = [];
  const repository = new MySqlBiAgendaRepository({
    async queryRunner(sql, params) {
      calls.push({ params, sql });
      return [[]];
    },
  });
  const current = { endDate: "2026-07-31", startDate: "2026-07-01", unitId: "3" };
  await repository.getAgendaAnalytics({ current });

  assert.equal(calls.length, 2);
  assert.equal(seriesParams(current).length, (BI_AGENDA_SERIES_SQL.match(/\?/g) || []).length);
  assert.equal(
    exceptionParams(current).length,
    (BI_AGENDA_EXCEPTIONS_SQL.match(/\?/g) || []).length,
  );
  for (const { sql } of calls) {
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i);
    assert.doesNotMatch(sql, /SELECT\s+\*/i);
    assert.doesNotMatch(sql, /student|professor|phone|email|cpf|address|name/i);
  }
  assert.match(BI_AGENDA_SERIES_SQL, /turma\.unidade_id AS CHAR\) = \?/);
  assert.match(BI_AGENDA_EXCEPTIONS_SQL, /occurrence_date BETWEEN \? AND \?/);
});

test("Agenda repository maps aggregate rows and safely handles null and invalid numbers", async () => {
  let call = 0;
  const repository = new MySqlBiAgendaRepository({
    async queryRunner() {
      call += 1;
      if (call === 1) {
        return [[{ active_series: "4", cancelled_series: null, recurrence_series: "5" }]];
      }
      return [[
        {
          cancelled_occurrences: "2",
          modified_occurrences: Number.POSITIVE_INFINITY,
          occurrence_date: "2026-07-10",
        },
      ]];
    },
  });
  const result = await repository.getAgendaAnalytics({
    current: { endDate: "2026-07-31", startDate: "2026-07-01", unitId: null },
  });
  assert.deepEqual(result.series, {
    activeSeries: 4,
    cancelledSeries: 0,
    recurrenceSeries: 5,
  });
  assert.equal(result.cancelledOccurrences, 2);
  assert.equal(result.modifiedOccurrences, 0);
});
