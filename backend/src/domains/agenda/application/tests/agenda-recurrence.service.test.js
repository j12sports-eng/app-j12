const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AGENDA_RECURRENCE_RULE_INVALID_CODE,
  AgendaRecurrenceService,
  RECURRENCE_EXCEPTION_TYPES,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_OPERATION_SCOPES,
  buildRecurrenceOccurrenceKey,
  generateRecurrenceOccurrences,
  normalizeRecurrenceRule,
} = require("../services/agenda-recurrence.service.js");

test("normalizeRecurrenceRule supports daily, weekly, biweekly, monthly and custom frequencies", () => {
  assert.equal(
    normalizeRecurrenceRule({
      frequency: "diaria",
      startDate: "2026-07-06",
      startTime: "08:00",
    }).intervalUnit,
    "DAY",
  );
  assert.deepEqual(
    normalizeRecurrenceRule({
      frequency: "semanal",
      startDate: "2026-07-06",
      startTime: "08:00",
    }).daysOfWeek,
    [1],
  );
  assert.equal(
    normalizeRecurrenceRule({
      frequency: "quinzenal",
      startDate: "2026-07-06",
      startTime: "08:00",
    }).intervalValue,
    2,
  );
  assert.equal(
    normalizeRecurrenceRule({
      frequency: "mensal",
      startDate: "2026-07-06",
      startTime: "08:00",
    }).intervalUnit,
    "MONTH",
  );
  assert.equal(
    normalizeRecurrenceRule({
      customInterval: 3,
      customIntervalUnit: "dias",
      frequency: "personalizada",
      startDate: "2026-07-06",
      startTime: "08:00",
    }).frequency,
    RECURRENCE_FREQUENCIES.CUSTOM,
  );
});

test("generateRecurrenceOccurrences projects specific weekdays and max occurrences without duplicates", () => {
  const result = generateRecurrenceOccurrences(
    {
      daysOfWeek: ["segunda", "quarta"],
      frequency: "weekly",
      id: "series-1",
      maxOccurrences: 4,
      startDate: "2026-07-06",
      startTime: "08:00",
    },
    { limit: 10 },
  );

  assert.deepEqual(
    result.occurrences.map((occurrence) => occurrence.date),
    ["2026-07-06", "2026-07-08", "2026-07-13", "2026-07-15"],
  );
  assert.equal(new Set(result.occurrences.map((occurrence) => occurrence.id)).size, 4);
  assert.equal(result.truncated, false);
});

test("generateRecurrenceOccurrences supports biweekly and end date limits", () => {
  const result = generateRecurrenceOccurrences(
    {
      daysOfWeek: [1],
      endDate: "2026-08-10",
      frequency: "BIWEEKLY",
      id: "series-2",
      startDate: "2026-07-06",
      startTime: "08:00",
    },
    { limit: 10 },
  );

  assert.deepEqual(
    result.occurrences.map((occurrence) => occurrence.date),
    ["2026-07-06", "2026-07-20", "2026-08-03"],
  );
});

test("generateRecurrenceOccurrences supports monthly clamped day-of-month rules", () => {
  const result = generateRecurrenceOccurrences(
    {
      frequency: "MONTHLY",
      id: "series-3",
      maxOccurrences: 3,
      startDate: "2026-01-31",
      startTime: "08:00",
    },
    { limit: 5 },
  );

  assert.deepEqual(
    result.occurrences.map((occurrence) => occurrence.date),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
});

test("generateRecurrenceOccurrences applies cancelled and modified exceptions", () => {
  const occurrenceKey = buildRecurrenceOccurrenceKey("series-4", "2026-07-13", "08:00");
  const result = generateRecurrenceOccurrences(
    {
      daysOfWeek: [1],
      frequency: "WEEKLY",
      id: "series-4",
      maxOccurrences: 3,
      startDate: "2026-07-06",
      startTime: "08:00",
    },
    {
      exceptions: [
        {
          exceptionType: RECURRENCE_EXCEPTION_TYPES.MODIFIED,
          occurrenceDate: "2026-07-13",
          occurrenceKey,
          override: {
            date: "2026-07-14",
            startTime: "09:00",
          },
          seriesId: "series-4",
        },
      ],
      limit: 5,
    },
  );

  assert.equal(result.occurrences[1].date, "2026-07-14");
  assert.equal(result.occurrences[1].originalDate, "2026-07-13");
  assert.equal(result.occurrences[1].startTime, "09:00");
  assert.equal(result.occurrences[1].isException, true);
});

test("generateRecurrenceOccurrences can include cancelled exceptions for visual highlighting", () => {
  const occurrenceKey = buildRecurrenceOccurrenceKey("series-5", "2026-07-13", "08:00");
  const result = generateRecurrenceOccurrences(
    {
      daysOfWeek: [1],
      frequency: "WEEKLY",
      id: "series-5",
      maxOccurrences: 2,
      startDate: "2026-07-06",
      startTime: "08:00",
    },
    {
      exceptions: [
        {
          exceptionType: RECURRENCE_EXCEPTION_TYPES.CANCELLED,
          occurrenceDate: "2026-07-13",
          occurrenceKey,
          seriesId: "series-5",
        },
      ],
      includeCancelled: true,
      limit: 5,
    },
  );

  assert.equal(result.occurrences[1].status, "CANCELLED");
  assert.equal(result.occurrences[1].exceptionType, RECURRENCE_EXCEPTION_TYPES.CANCELLED);
});

test("AgendaRecurrenceService delegates create, occurrence cancel, series cancel and split scopes", async () => {
  const calls = [];
  const repository = {
    async cancelRecurrenceSeries(input) {
      calls.push(["cancelRecurrenceSeries", input]);
      return { id: input.seriesId, status: "CANCELLED" };
    },
    async createRecurrenceException(input) {
      calls.push(["createRecurrenceException", input]);
      return { id: "exception-1", seriesId: input.seriesId };
    },
    async createRecurrenceSeries(input) {
      calls.push(["createRecurrenceSeries", input]);
      return { id: "series-created", frequency: input.frequency };
    },
    async findAgendaAdministrativeBlocks() {
      return [];
    },
    async findAgendaConflictCandidates() {
      return [];
    },
    async findSchedulesByClass() {
      return [];
    },
    async findSchedulesByEnrollment() {
      return [];
    },
    async findSchedulesByStudent() {
      return [];
    },
    async splitRecurrenceSeries(input) {
      calls.push(["splitRecurrenceSeries", input]);
      return { nextSeries: { id: "series-next" }, previousSeries: { id: input.seriesId } };
    },
    async updateRecurrenceSeries(input) {
      calls.push(["updateRecurrenceSeries", input]);
      return { id: input.seriesId, updated: true };
    },
  };
  const service = new AgendaRecurrenceService({ agendaRepository: repository });

  await service.createRecurrenceSeries({
    daysOfWeek: [1],
    frequency: "WEEKLY",
    startDate: "2026-07-06",
    startTime: "08:00",
  });
  await service.cancelRecurrence({
    occurrenceDate: "2026-07-13",
    scope: RECURRENCE_OPERATION_SCOPES.THIS_OCCURRENCE,
    seriesId: "series-1",
  });
  await service.cancelRecurrence({
    scope: RECURRENCE_OPERATION_SCOPES.SERIES,
    seriesId: "series-1",
  });
  await service.updateRecurrence({
    frequency: "WEEKLY",
    occurrenceDate: "2026-07-20",
    scope: RECURRENCE_OPERATION_SCOPES.THIS_AND_FOLLOWING,
    seriesId: "series-1",
    startDate: "2026-07-06",
    startTime: "09:00",
  });

  assert.deepEqual(
    calls.map(([name]) => name),
    [
      "createRecurrenceSeries",
      "createRecurrenceException",
      "cancelRecurrenceSeries",
      "splitRecurrenceSeries",
    ],
  );
});

test("AgendaRecurrenceService rejects invalid recurrence windows", () => {
  assert.throws(
    () =>
      normalizeRecurrenceRule({
        endDate: "2026-07-01",
        frequency: "DAILY",
        startDate: "2026-07-06",
        startTime: "08:00",
      }),
    { code: AGENDA_RECURRENCE_RULE_INVALID_CODE },
  );
});
