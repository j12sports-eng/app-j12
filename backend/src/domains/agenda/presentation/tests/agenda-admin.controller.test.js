const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AgendaAdminController,
} = require("../controllers/agenda-admin.controller.js");
const {
  AGENDA_ADMIN_ROUTE_BASE_PATH,
  createAgendaAdminRouter,
} = require("../routes/agenda-admin.routes.js");

test("AgendaAdminController delegates admin operations only to AgendaFacade", async () => {
  const calls = [];
  const controller = new AgendaAdminController({
    agendaFacade: {
      async findSchedulesByClass(input) {
        calls.push(["class", input]);
        return [{ classId: input.classId }];
      },
      async getAgendaSummaryByStudent(input) {
        calls.push(["student", input]);
        return { schedules: [{ studentPersonId: input.studentPersonId }] };
      },
      async getEnrollmentAgendaSummary(input) {
        calls.push(["enrollment", input]);
        return { schedules: [{ enrollmentId: input.enrollmentId }] };
      },
      async previewRecurrence(input) {
        calls.push(["recurrencePreview", input]);
        return { occurrenceCount: 2 };
      },
      async createRecurrenceSeries(input) {
        calls.push(["recurrenceCreate", input]);
        return { series: { id: "series-1" } };
      },
      async getRecurrenceSeries(input) {
        calls.push(["recurrenceGet", input]);
        return { series: { id: input.seriesId } };
      },
      async updateRecurrence(input) {
        calls.push(["recurrenceUpdate", input]);
        return { recurrenceUpdated: true };
      },
      async cancelRecurrence(input) {
        calls.push(["recurrenceCancel", input]);
        return { recurrenceCancelled: true };
      },
      async rescheduleAgendaEvent(input) {
        calls.push(["reschedule", input]);
        return { updatedSchedule: { id: input.eventId } };
      },
      async validateAgendaEvent(input) {
        calls.push(["validate", input]);
        return { canConfirm: true };
      },
    },
  });

  await controller.getClassSchedules(
    { params: { classId: "7" }, query: { limit: "5" } },
    createResponse(),
    assertNoNext,
  );
  await controller.getEnrollmentSummary(
    { params: { enrollmentId: "enr-1" }, query: {} },
    createResponse(),
    assertNoNext,
  );
  await controller.getStudentSummary(
    {
      params: {
        studentPersonId: "person-1",
        studentProfileId: "profile-1",
      },
      query: { limit: "20" },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.validateEvent(
    {
      body: {
        toDate: "2026-07-06",
        toStartTime: "08:00",
      },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.rescheduleEvent(
    {
      auth: { email: "admin@j12.local" },
      body: {
        toDate: "2026-07-06",
        toStartTime: "08:00",
      },
      params: { eventId: "agenda-1" },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.previewRecurrence(
    {
      body: {
        frequency: "WEEKLY",
        startDate: "2026-07-06",
        startTime: "08:00",
      },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.createRecurrenceSeries(
    {
      auth: { email: "admin@j12.local" },
      body: {
        frequency: "WEEKLY",
        startDate: "2026-07-06",
        startTime: "08:00",
      },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.getRecurrenceSeries(
    { params: { seriesId: "series-1" }, query: { limit: "12" } },
    createResponse(),
    assertNoNext,
  );
  await controller.updateRecurrence(
    {
      body: { scope: "SERIES", startTime: "09:00" },
      params: { seriesId: "series-1" },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.cancelRecurrence(
    {
      body: { reason: "cancelar serie" },
      params: { seriesId: "series-1" },
    },
    createResponse(),
    assertNoNext,
  );
  await controller.cancelRecurrence(
    {
      body: { occurrenceDate: "2026-07-13" },
      params: { occurrenceKey: "series-1:2026-07-13:08:00", seriesId: "series-1" },
    },
    createResponse(),
    assertNoNext,
  );

  assert.deepEqual(calls, [
    ["class", { classId: "7", limit: 5 }],
    ["enrollment", { enrollmentId: "enr-1", limit: 100 }],
    [
      "student",
      {
        limit: 20,
        studentPersonId: "person-1",
        studentProfileId: "profile-1",
      },
    ],
    [
      "validate",
      {
        action: "VALIDATE",
        eventId: null,
        requestedBy: null,
        toDate: "2026-07-06",
        toStartTime: "08:00",
      },
    ],
    [
      "reschedule",
      {
        action: "RESCHEDULE",
        eventId: "agenda-1",
        requestedBy: "admin@j12.local",
        toDate: "2026-07-06",
        toStartTime: "08:00",
      },
    ],
    [
      "recurrencePreview",
      {
        frequency: "WEEKLY",
        limit: 100,
        occurrenceKey: null,
        requestedBy: null,
        seriesId: null,
        startDate: "2026-07-06",
        startTime: "08:00",
      },
    ],
    [
      "recurrenceCreate",
      {
        frequency: "WEEKLY",
        limit: 100,
        occurrenceKey: null,
        requestedBy: "admin@j12.local",
        seriesId: null,
        startDate: "2026-07-06",
        startTime: "08:00",
      },
    ],
    [
      "recurrenceGet",
      {
        limit: 12,
        occurrenceKey: null,
        requestedBy: null,
        seriesId: "series-1",
      },
    ],
    [
      "recurrenceUpdate",
      {
        limit: 100,
        occurrenceKey: null,
        requestedBy: null,
        scope: "SERIES",
        seriesId: "series-1",
        startTime: "09:00",
      },
    ],
    [
      "recurrenceCancel",
      {
        limit: 100,
        occurrenceKey: null,
        reason: "cancelar serie",
        requestedBy: null,
        scope: "SERIES",
        seriesId: "series-1",
      },
    ],
    [
      "recurrenceCancel",
      {
        limit: 100,
        occurrenceDate: "2026-07-13",
        occurrenceKey: "series-1:2026-07-13:08:00",
        requestedBy: null,
        scope: "THIS_OCCURRENCE",
        seriesId: "series-1",
      },
    ],
  ]);
});

test("AgendaAdminRouter registers secured administrative endpoints", () => {
  const controller = {
    cancelRecurrence() {},
    createRecurrenceSeries() {},
    getClassSchedules() {},
    getEnrollmentSummary() {},
    getRecurrenceSeries() {},
    getStudentSummary() {},
    previewRecurrence() {},
    rescheduleEvent() {},
    updateRecurrence() {},
    validateEvent() {},
  };
  const router = createAgendaAdminRouter({
    accessMiddleware(_req, _res, next) {
      next();
    },
    authMiddleware(_req, _res, next) {
      next();
    },
    controller,
  });
  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      methods: Object.keys(layer.route.methods).sort(),
      path: layer.route.path,
    }));

  assert.equal(AGENDA_ADMIN_ROUTE_BASE_PATH, "/admin/agenda");
  assert.deepEqual(routes, [
    { methods: ["get"], path: "/students/:studentPersonId/:studentProfileId/summary" },
    { methods: ["get"], path: "/enrollments/:enrollmentId/summary" },
    { methods: ["get"], path: "/classes/:classId/schedules" },
    { methods: ["post"], path: "/events/validate" },
    { methods: ["patch"], path: "/events/:eventId/reschedule" },
    { methods: ["post"], path: "/recurrences/preview" },
    { methods: ["post"], path: "/recurrences" },
    { methods: ["get"], path: "/recurrences/:seriesId" },
    { methods: ["patch"], path: "/recurrences/:seriesId" },
    { methods: ["delete"], path: "/recurrences/:seriesId" },
    { methods: ["patch"], path: "/recurrences/:seriesId/occurrences/:occurrenceKey" },
    { methods: ["delete"], path: "/recurrences/:seriesId/occurrences/:occurrenceKey" },
  ]);
  assert.equal(router.stack[0].route, undefined);
  assert.equal(router.stack[1].route, undefined);
});

function createResponse() {
  return {
    body: null,
    statusCode: 200,
    json(payload) {
      this.body = payload;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

function assertNoNext(error) {
  if (error) {
    throw error;
  }
}
