const { AgendaFacade } = require("../../application/facades/agenda.facade.js");
const {
  AGENDA_CONFLICT_VALIDATION_FAILED_CODE,
} = require("../../application/services/agenda-conflict-validation.service.js");
const {
  AGENDA_RECURRENCE_NOT_FOUND_CODE,
  AGENDA_RECURRENCE_OCCURRENCE_REQUIRED_CODE,
  AGENDA_RECURRENCE_REPOSITORY_REQUIRED_CODE,
  AGENDA_RECURRENCE_RULE_INVALID_CODE,
  AGENDA_RECURRENCE_SCOPE_INVALID_CODE,
  AGENDA_RECURRENCE_SERIES_ID_REQUIRED_CODE,
  RECURRENCE_OPERATION_SCOPES,
} = require("../../application/services/agenda-recurrence.service.js");

const AGENDA_ADMIN_INPUT_REQUIRED_CODE = "AGENDA_ADMIN_INPUT_REQUIRED";
const AGENDA_ADMIN_ERROR_CODE = "AGENDA_ADMIN_ERROR";

const CONTROLLED_ERROR_STATUS_BY_CODE = Object.freeze({
  [AGENDA_ADMIN_INPUT_REQUIRED_CODE]: 400,
  [AGENDA_CONFLICT_VALIDATION_FAILED_CODE]: 409,
  [AGENDA_RECURRENCE_NOT_FOUND_CODE]: 404,
  [AGENDA_RECURRENCE_OCCURRENCE_REQUIRED_CODE]: 400,
  [AGENDA_RECURRENCE_REPOSITORY_REQUIRED_CODE]: 500,
  [AGENDA_RECURRENCE_RULE_INVALID_CODE]: 400,
  [AGENDA_RECURRENCE_SCOPE_INVALID_CODE]: 400,
  [AGENDA_RECURRENCE_SERIES_ID_REQUIRED_CODE]: 400,
  AGENDA_REPOSITORY_REQUIRED: 500,
});

/**
 * Administrative Agenda controller.
 *
 * This boundary delegates to AgendaFacade only. Conflict rules remain
 * centralized in the Agenda application service.
 */
class AgendaAdminController {
  /**
   * @param {Object} [options]
   * @param {AgendaFacade} [options.agendaFacade]
   * @param {AgendaFacade} [options.facade]
   */
  constructor(options = {}) {
    this.agendaFacade = options.agendaFacade || options.facade || new AgendaFacade(options);

    this.getClassSchedules = this.getClassSchedules.bind(this);
    this.getEnrollmentSummary = this.getEnrollmentSummary.bind(this);
    this.getRecurrenceSeries = this.getRecurrenceSeries.bind(this);
    this.getStudentSummary = this.getStudentSummary.bind(this);
    this.cancelRecurrence = this.cancelRecurrence.bind(this);
    this.createRecurrenceSeries = this.createRecurrenceSeries.bind(this);
    this.previewRecurrence = this.previewRecurrence.bind(this);
    this.rescheduleEvent = this.rescheduleEvent.bind(this);
    this.updateRecurrence = this.updateRecurrence.bind(this);
    this.validateEvent = this.validateEvent.bind(this);
  }

  /**
   * GET /admin/agenda/classes/:classId/schedules
   */
  async getClassSchedules(req, res, next) {
    try {
      const input = readClassSchedulesInput(req);
      const validation = validateRequired(input, ["classId"]);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const schedules = await this.getFacade().findSchedulesByClass(input);
      return sendSuccess(res, {
        agendaSource: "j12_turmas via enrollment_class_links ACTIVE",
        classId: input.classId,
        noAttendanceCreated: true,
        noFinancialSideEffects: true,
        noNotificationSideEffects: true,
        readOnly: true,
        scheduleCount: schedules.length,
        schedules,
      });
    } catch (error) {
      return handleAgendaAdminError(error, res, next);
    }
  }

  /**
   * GET /admin/agenda/enrollments/:enrollmentId/summary
   */
  async getEnrollmentSummary(req, res, next) {
    try {
      const input = readEnrollmentSummaryInput(req);
      const validation = validateRequired(input, ["enrollmentId"]);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const data = await this.getFacade().getEnrollmentAgendaSummary(input);
      return sendSuccess(res, limitSchedules(data, input.limit));
    } catch (error) {
      return handleAgendaAdminError(error, res, next);
    }
  }

  /**
   * GET /admin/agenda/students/:studentPersonId/:studentProfileId/summary
   */
  async getStudentSummary(req, res, next) {
    try {
      const input = readStudentSummaryInput(req);
      const validation = validateRequired(input, ["studentPersonId", "studentProfileId"]);

      if (!validation.valid) {
        return sendBadRequest(res, validation);
      }

      const data = await this.getFacade().getAgendaSummaryByStudent(input);
      return sendSuccess(res, limitSchedules(data, input.limit));
    } catch (error) {
      return handleAgendaAdminError(error, res, next);
    }
  }

  /**
   * POST /admin/agenda/events/validate
   */
  async validateEvent(req, res, next) {
    try {
      const data = await this.getFacade().validateAgendaEvent(readAgendaEventInput(req, "VALIDATE"));
      return sendSuccess(res, data);
    } catch (error) {
      return handleAgendaAdminError(error, res, next);
    }
  }

  /**
   * PATCH /admin/agenda/events/:eventId/reschedule
   */
  async rescheduleEvent(req, res, next) {
    try {
      const data = await this.getFacade().rescheduleAgendaEvent(
        readAgendaEventInput(req, "RESCHEDULE"),
      );
      return sendSuccess(res, data);
    } catch (error) {
      return handleAgendaAdminError(error, res, next);
    }
  }

  /**
   * POST /admin/agenda/recurrences/preview
   */
  async previewRecurrence(req, res, next) {
    try {
      const data = await this.getFacade().previewRecurrence(readRecurrenceInput(req));
      return sendSuccess(res, data);
    } catch (error) {
      return handleAgendaAdminError(error, res, next);
    }
  }

  /**
   * POST /admin/agenda/recurrences
   */
  async createRecurrenceSeries(req, res, next) {
    try {
      const data = await this.getFacade().createRecurrenceSeries(readRecurrenceInput(req));
      return sendSuccess(res, data);
    } catch (error) {
      return handleAgendaAdminError(error, res, next);
    }
  }

  /**
   * GET /admin/agenda/recurrences/:seriesId
   */
  async getRecurrenceSeries(req, res, next) {
    try {
      const data = await this.getFacade().getRecurrenceSeries(readRecurrenceInput(req));
      return sendSuccess(res, data);
    } catch (error) {
      return handleAgendaAdminError(error, res, next);
    }
  }

  /**
   * PATCH /admin/agenda/recurrences/:seriesId
   * PATCH /admin/agenda/recurrences/:seriesId/occurrences/:occurrenceKey
   */
  async updateRecurrence(req, res, next) {
    try {
      const data = await this.getFacade().updateRecurrence(readRecurrenceInput(req));
      return sendSuccess(res, data);
    } catch (error) {
      return handleAgendaAdminError(error, res, next);
    }
  }

  /**
   * DELETE /admin/agenda/recurrences/:seriesId
   * DELETE /admin/agenda/recurrences/:seriesId/occurrences/:occurrenceKey
   */
  async cancelRecurrence(req, res, next) {
    try {
      const input = readRecurrenceInput(req);
      const data = await this.getFacade().cancelRecurrence({
        ...input,
        scope: input.occurrenceKey
          ? input.scope || RECURRENCE_OPERATION_SCOPES.THIS_OCCURRENCE
          : input.scope || RECURRENCE_OPERATION_SCOPES.SERIES,
      });
      return sendSuccess(res, data);
    } catch (error) {
      return handleAgendaAdminError(error, res, next);
    }
  }

  /**
   * @returns {AgendaFacade}
   */
  getFacade() {
    if (!this.agendaFacade || typeof this.agendaFacade !== "object") {
      throw new TypeError("AgendaAdminController requires AgendaFacade.");
    }

    return this.agendaFacade;
  }
}

function readClassSchedulesInput(req = {}) {
  const params = readObject(req.params);
  const query = readObject(req.query);

  return {
    classId: nullableText(params.classId ?? query.classId, 64),
    limit: normalizeLimit(query.limit, 250),
  };
}

function readEnrollmentSummaryInput(req = {}) {
  const params = readObject(req.params);
  const query = readObject(req.query);

  return {
    enrollmentId: nullableText(params.enrollmentId ?? query.enrollmentId, 64),
    limit: normalizeLimit(query.limit, 250),
  };
}

function readStudentSummaryInput(req = {}) {
  const params = readObject(req.params);
  const query = readObject(req.query);

  return {
    limit: normalizeLimit(query.limit, 250),
    studentPersonId: nullableText(params.studentPersonId ?? query.studentPersonId, 64),
    studentProfileId: nullableText(params.studentProfileId ?? query.studentProfileId, 64),
  };
}

function readAgendaEventInput(req = {}, action = "VALIDATE") {
  const params = readObject(req.params);
  const body = readObject(req.body);

  return {
    ...body,
    action,
    eventId: nullableText(params.eventId ?? body.eventId ?? body.calendarEventId, 191),
    requestedBy: nullableText(body.requestedBy ?? readActor(req), 191),
  };
}

function readRecurrenceInput(req = {}) {
  const params = readObject(req.params);
  const query = readObject(req.query);
  const body = readObject(req.body);

  return {
    ...query,
    ...body,
    limit: normalizeLimit(body.limit ?? query.limit, 500),
    occurrenceKey: nullableText(
      params.occurrenceKey ?? body.occurrenceKey ?? query.occurrenceKey,
      191,
    ),
    requestedBy: nullableText(body.requestedBy ?? readActor(req), 191),
    seriesId: nullableText(params.seriesId ?? body.seriesId ?? query.seriesId, 64),
  };
}

function readActor(req = {}) {
  const user = req?.auth || req?.user || {};
  return user.email || user.login || user.username || user.id || null;
}

function limitSchedules(data, limit) {
  if (!data || typeof data !== "object" || !Number.isInteger(limit)) {
    return data;
  }

  const nextData = { ...data };

  for (const key of ["schedules", "scheduleCandidates", "agendaItems"]) {
    if (Array.isArray(nextData[key])) {
      nextData[key] = nextData[key].slice(0, limit);
    }
  }

  return nextData;
}

function validateRequired(input = {}, fields = []) {
  const missingFields = fields.filter((field) => !nullableText(input[field], 191));

  return {
    code: AGENDA_ADMIN_INPUT_REQUIRED_CODE,
    message: `${fields.join(" and ")} are required.`,
    missingFields,
    valid: missingFields.length === 0,
  };
}

function successEnvelope(data) {
  return {
    data,
    success: true,
  };
}

function sendSuccess(res, data) {
  return res.json(successEnvelope(data));
}

function sendBadRequest(res, validation) {
  return res.status(400).json({
    code: validation.code,
    error: validation.message,
    missingFields: validation.missingFields || [],
    success: false,
  });
}

function sendControlledError(res, error = {}) {
  const code = nullableText(error.code, 100) || AGENDA_ADMIN_ERROR_CODE;
  const statusCode =
    Number(error.statusCode || error.status) || CONTROLLED_ERROR_STATUS_BY_CODE[code] || 400;

  return res.status(statusCode).json({
    code,
    data: error.details || null,
    error: nullableText(error.message, 500) || "Agenda admin operation failed.",
    success: false,
  });
}

function handleAgendaAdminError(error, res, next) {
  const code = nullableText(error?.code, 100);

  if (code && CONTROLLED_ERROR_STATUS_BY_CODE[code]) {
    return sendControlledError(res, {
      code,
      details: error?.details || null,
      message: error instanceof Error ? error.message : String(error ?? "Agenda error."),
      statusCode: CONTROLLED_ERROR_STATUS_BY_CODE[code],
    });
  }

  return next(error);
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeLimit(value, max = 250) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(100, max);
  }

  return Math.min(Math.trunc(parsed), max);
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

module.exports = {
  AGENDA_ADMIN_ERROR_CODE,
  AGENDA_ADMIN_INPUT_REQUIRED_CODE,
  AgendaAdminController,
  CONTROLLED_ERROR_STATUS_BY_CODE,
  handleAgendaAdminError,
  nullableText,
  normalizeLimit,
  readAgendaEventInput,
  readClassSchedulesInput,
  readEnrollmentSummaryInput,
  readRecurrenceInput,
  readStudentSummaryInput,
  successEnvelope,
  validateRequired,
};
