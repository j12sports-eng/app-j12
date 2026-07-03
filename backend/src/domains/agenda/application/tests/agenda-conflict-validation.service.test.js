const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AGENDA_CONFLICT_ADMIN_BLOCK_CODE,
  AGENDA_CONFLICT_CLASS_CAPACITY_FULL_CODE,
  AGENDA_CONFLICT_CLASS_DUPLICATE_CODE,
  AGENDA_CONFLICT_COURT_OVERLAP_CODE,
  AGENDA_CONFLICT_DATE_UNAVAILABLE_CODE,
  AGENDA_CONFLICT_PROFESSOR_OVERLAP_CODE,
  AGENDA_CONFLICT_STUDENT_OVERLAP_CODE,
  AGENDA_EVENT_CANCELLED_CODE,
  AGENDA_RECURRENCE_SCOPE_WARNING_CODE,
  AgendaConflictValidationService,
} = require("../services/agenda-conflict-validation.service.js");

test("AgendaConflictValidationService blocks partial overlaps by professor, court, student and class", async () => {
  const service = new AgendaConflictValidationService({
    agendaRepository: {
      async findAgendaConflictCandidates() {
        return [
          {
            agendaItemId: "agenda-conflict",
            classId: 7,
            courtName: "Quadra 1",
            dayOfWeek: "segunda",
            endTime: "09:30",
            enrollmentId: "enrollment-2",
            professorId: "prof-1",
            startTime: "08:30",
            studentPersonId: "person-1",
            studentProfileId: "profile-1",
          },
        ];
      },
    },
  });

  const result = await service.validateAgendaEvent({
    action: "MOVE",
    classId: 7,
    courtName: "Quadra 1",
    studentPersonId: "person-1",
    studentProfileId: "profile-1",
    professorId: "prof-1",
    toDate: "2026-07-06",
    toEndTime: "09:00",
    toStartTime: "08:00",
  });
  const codes = result.conflicts.map((conflict) => conflict.code);

  assert.equal(result.canConfirm, false);
  assert.equal(result.hasCriticalConflicts, true);
  assert.ok(codes.includes(AGENDA_CONFLICT_PROFESSOR_OVERLAP_CODE));
  assert.ok(codes.includes(AGENDA_CONFLICT_COURT_OVERLAP_CODE));
  assert.ok(codes.includes(AGENDA_CONFLICT_STUDENT_OVERLAP_CODE));
  assert.ok(codes.includes(AGENDA_CONFLICT_CLASS_DUPLICATE_CODE));
});

test("AgendaConflictValidationService treats configured administrative blocks and unavailable dates as conflicts", async () => {
  const service = new AgendaConflictValidationService();

  const result = await service.validateAgendaEvent({
    administrativeBlocks: [
      {
        blockType: "BLOCKED_TIME",
        date: "2026-07-06",
        endTime: "10:00",
        message: "Manutencao da quadra.",
        startTime: "08:00",
      },
    ],
    classId: 7,
    toDate: "2026-07-06",
    toEndTime: "09:00",
    toStartTime: "08:30",
    unavailableDates: ["2026-07-06"],
  });
  const codes = result.conflicts.map((conflict) => conflict.code);

  assert.equal(result.canConfirm, false);
  assert.ok(codes.includes(AGENDA_CONFLICT_ADMIN_BLOCK_CODE));
  assert.ok(codes.includes(AGENDA_CONFLICT_DATE_UNAVAILABLE_CODE));
});

test("AgendaConflictValidationService allows warnings when capacity is full during reschedule", async () => {
  const service = new AgendaConflictValidationService({
    classFacade: {
      async getClassCapacitySummary() {
        return {
          capacityTotal: 2,
          occupiedSlots: 2,
        };
      },
    },
  });

  const result = await service.validateAgendaEvent({
    action: "RESCHEDULE",
    classId: 7,
    toDate: "2026-07-06",
    toEndTime: "09:00",
    toStartTime: "08:00",
  });

  assert.equal(result.canConfirm, true);
  assert.equal(result.hasWarnings, true);
  assert.equal(result.warnings[0].code, AGENDA_CONFLICT_CLASS_CAPACITY_FULL_CODE);
});

test("AgendaConflictValidationService blocks lifecycle errors and warns about recurring projection scope", async () => {
  const service = new AgendaConflictValidationService();
  const result = await service.validateAgendaEvent({
    action: "RESCHEDULE",
    isRecurringProjection: true,
    status: "CANCELLED",
    toDate: "2026-07-06",
    toEndTime: "09:00",
    toStartTime: "08:00",
  });
  const codes = result.conflicts.map((conflict) => conflict.code);

  assert.equal(result.canConfirm, false);
  assert.ok(codes.includes(AGENDA_EVENT_CANCELLED_CODE));
  assert.ok(codes.includes(AGENDA_RECURRENCE_SCOPE_WARNING_CODE));
  assert.equal(result.warnings.length, 1);
});
