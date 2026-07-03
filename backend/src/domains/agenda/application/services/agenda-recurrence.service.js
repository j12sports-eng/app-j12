const crypto = require("node:crypto");

const {
  AGENDA_CONFLICT_VALIDATION_FAILED_CODE,
  AgendaConflictValidationService,
} = require("./agenda-conflict-validation.service.js");

const AGENDA_RECURRENCE_REPOSITORY_REQUIRED_CODE = "AGENDA_RECURRENCE_REPOSITORY_REQUIRED";
const AGENDA_RECURRENCE_RULE_INVALID_CODE = "AGENDA_RECURRENCE_RULE_INVALID";
const AGENDA_RECURRENCE_SERIES_ID_REQUIRED_CODE = "AGENDA_RECURRENCE_SERIES_ID_REQUIRED";
const AGENDA_RECURRENCE_OCCURRENCE_REQUIRED_CODE = "AGENDA_RECURRENCE_OCCURRENCE_REQUIRED";
const AGENDA_RECURRENCE_NOT_FOUND_CODE = "AGENDA_RECURRENCE_NOT_FOUND";
const AGENDA_RECURRENCE_SCOPE_INVALID_CODE = "AGENDA_RECURRENCE_SCOPE_INVALID";

const RECURRENCE_FREQUENCIES = Object.freeze({
  BIWEEKLY: "BIWEEKLY",
  CUSTOM: "CUSTOM",
  DAILY: "DAILY",
  MONTHLY: "MONTHLY",
  WEEKLY: "WEEKLY",
});
const RECURRENCE_INTERVAL_UNITS = Object.freeze({
  DAY: "DAY",
  MONTH: "MONTH",
  WEEK: "WEEK",
});
const RECURRENCE_EXCEPTION_TYPES = Object.freeze({
  CANCELLED: "CANCELLED",
  MODIFIED: "MODIFIED",
});
const RECURRENCE_OPERATION_SCOPES = Object.freeze({
  SERIES: "SERIES",
  THIS_AND_FOLLOWING: "THIS_AND_FOLLOWING",
  THIS_OCCURRENCE: "THIS_OCCURRENCE",
});

const ACTIVE_RECURRENCE_STATUS = "ACTIVE";
const CANCELLED_RECURRENCE_STATUS = "CANCELLED";
const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_PREVIEW_LIMIT = 64;
const MAX_GENERATION_LIMIT = 3700;
const WEEKDAY_LABELS = Object.freeze([
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
]);
const WEEKDAY_ALIASES = new Map([
  ["0", 0],
  ["7", 0],
  ["domingo", 0],
  ["dom", 0],
  ["sunday", 0],
  ["sun", 0],
  ["1", 1],
  ["segunda", 1],
  ["segunda-feira", 1],
  ["seg", 1],
  ["monday", 1],
  ["mon", 1],
  ["2", 2],
  ["terca", 2],
  ["terca-feira", 2],
  ["ter", 2],
  ["tuesday", 2],
  ["tue", 2],
  ["3", 3],
  ["quarta", 3],
  ["quarta-feira", 3],
  ["qua", 3],
  ["wednesday", 3],
  ["wed", 3],
  ["4", 4],
  ["quinta", 4],
  ["quinta-feira", 4],
  ["qui", 4],
  ["thursday", 4],
  ["thu", 4],
  ["5", 5],
  ["sexta", 5],
  ["sexta-feira", 5],
  ["sex", 5],
  ["friday", 5],
  ["fri", 5],
  ["6", 6],
  ["sabado", 6],
  ["sabado-feira", 6],
  ["sab", 6],
  ["saturday", 6],
  ["sat", 6],
]);

class AgendaRecurrenceService {
  /**
   * @param {Object} [options]
   * @param {Record<string, Function>|null} [options.agendaRepository]
   * @param {Record<string, Function>|null} [options.classFacade]
   * @param {AgendaConflictValidationService|null} [options.conflictValidationService]
   */
  constructor({ agendaRepository = null, classFacade = null, conflictValidationService = null } = {}) {
    this.agendaRepository = agendaRepository;
    this.classFacade = classFacade;
    this.conflictValidationService = conflictValidationService;
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async previewRecurrence(input = {}) {
    const rule = normalizeRecurrenceRule(input);
    const generation = generateRecurrenceOccurrences(rule, {
      endDate: input.endDate || input.previewEndDate || input.untilDate,
      exceptions: input.exceptions,
      includeCancelled: input.includeCancelled !== false,
      limit: input.limit || input.maxPreviewOccurrences || DEFAULT_PREVIEW_LIMIT,
      startDate: input.startDate || input.previewStartDate,
    });

    return buildRecurrenceOperationResult({
      occurrences: generation.occurrences,
      recurrencePreview: true,
      rule,
      truncated: generation.truncated,
    });
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async createRecurrenceSeries(input = {}) {
    const repository = this.getRecurrenceRepository(["createRecurrenceSeries"]);
    const rule = normalizeRecurrenceRule(input);
    const work = async (agendaRepository = repository) => {
      const validation = await this.validateRecurrenceConflicts(rule, input, agendaRepository);

      if (!validation.canConfirm) {
        throw controlledError(
          "Recorrencia da Agenda possui conflitos criticos.",
          AGENDA_CONFLICT_VALIDATION_FAILED_CODE,
          { validation },
        );
      }

      const series = await agendaRepository.createRecurrenceSeries({
        ...rule,
        requestedBy: nullableText(input.requestedBy, 191),
        source: nullableText(input.source, 50) || "AGENDA_ADMIN",
      });

      return buildRecurrenceOperationResult({
        agendaConflictValidation: validation,
        occurrences: validation.checkedOccurrences,
        recurrenceCreated: true,
        rule,
        series,
      });
    };

    return this.withRecurrenceTransaction(repository, work);
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async getRecurrenceSeries(input = {}) {
    const seriesId = requiredText(input.seriesId || input.recurrenceSeriesId, "seriesId", 64);
    const repository = this.getRecurrenceRepository([
      "findRecurrenceExceptions",
      "findRecurrenceSeriesById",
    ]);
    const series = await repository.findRecurrenceSeriesById({ seriesId });

    if (!series) {
      throw controlledError(
        "Serie de recorrencia da Agenda nao encontrada.",
        AGENDA_RECURRENCE_NOT_FOUND_CODE,
        { seriesId },
      );
    }

    const exceptions = await repository.findRecurrenceExceptions({
      endDate: input.endDate || input.previewEndDate,
      seriesId,
      startDate: input.startDate || input.previewStartDate,
    });
    const rule = normalizeRecurrenceRule({ ...series, exceptions });
    const generation = generateRecurrenceOccurrences(rule, {
      endDate: input.endDate || input.previewEndDate,
      exceptions,
      includeCancelled: input.includeCancelled !== false,
      limit: input.limit || DEFAULT_PREVIEW_LIMIT,
      startDate: input.startDate || input.previewStartDate,
    });

    return buildRecurrenceOperationResult({
      exceptions,
      occurrences: generation.occurrences,
      recurrenceLoaded: true,
      rule,
      series,
      truncated: generation.truncated,
    });
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async cancelRecurrence(input = {}) {
    const scope = normalizeOperationScope(input.scope || input.deleteScope || input.recurrenceScope);
    const seriesId = requiredText(input.seriesId || input.recurrenceSeriesId, "seriesId", 64);

    if (scope === RECURRENCE_OPERATION_SCOPES.THIS_OCCURRENCE) {
      return this.cancelSingleOccurrence({ ...input, seriesId, scope });
    }

    if (scope === RECURRENCE_OPERATION_SCOPES.SERIES) {
      return this.cancelSeries({ ...input, seriesId, scope });
    }

    throw controlledError(
      "Escopo de exclusao de recorrencia invalido.",
      AGENDA_RECURRENCE_SCOPE_INVALID_CODE,
      { scope },
    );
  }

  /**
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async updateRecurrence(input = {}) {
    const scope = normalizeOperationScope(input.scope || input.updateScope || input.recurrenceUpdateScope);
    const seriesId = requiredText(input.seriesId || input.recurrenceSeriesId, "seriesId", 64);

    if (scope === RECURRENCE_OPERATION_SCOPES.THIS_OCCURRENCE) {
      return this.updateSingleOccurrence({ ...input, seriesId, scope });
    }

    if (scope === RECURRENCE_OPERATION_SCOPES.THIS_AND_FOLLOWING) {
      return this.updateThisAndFollowing({ ...input, seriesId, scope });
    }

    if (scope === RECURRENCE_OPERATION_SCOPES.SERIES) {
      return this.updateSeries({ ...input, seriesId, scope });
    }

    throw controlledError(
      "Escopo de edicao de recorrencia invalido.",
      AGENDA_RECURRENCE_SCOPE_INVALID_CODE,
      { scope },
    );
  }

  /**
   * @param {Record<string, unknown>} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async cancelSingleOccurrence(input) {
    const repository = this.getRecurrenceRepository(["createRecurrenceException"]);
    const occurrence = normalizeOccurrenceReference(input);
    const work = async (agendaRepository = repository) => {
      const exception = await agendaRepository.createRecurrenceException({
        exceptionType: RECURRENCE_EXCEPTION_TYPES.CANCELLED,
        occurrence,
        reason: nullableText(input.reason, 500),
        requestedBy: nullableText(input.requestedBy, 191),
        scope: RECURRENCE_OPERATION_SCOPES.THIS_OCCURRENCE,
        seriesId: input.seriesId,
      });

      return buildRecurrenceOperationResult({
        exception,
        occurrence,
        recurrenceCancelled: true,
        scope: RECURRENCE_OPERATION_SCOPES.THIS_OCCURRENCE,
      });
    };

    return this.withRecurrenceTransaction(repository, work);
  }

  /**
   * @param {Record<string, unknown>} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async cancelSeries(input) {
    const repository = this.getRecurrenceRepository(["cancelRecurrenceSeries"]);
    const work = async (agendaRepository = repository) => {
      const series = await agendaRepository.cancelRecurrenceSeries({
        reason: nullableText(input.reason, 500),
        requestedBy: nullableText(input.requestedBy, 191),
        seriesId: input.seriesId,
      });

      return buildRecurrenceOperationResult({
        recurrenceCancelled: true,
        scope: RECURRENCE_OPERATION_SCOPES.SERIES,
        series,
      });
    };

    return this.withRecurrenceTransaction(repository, work);
  }

  /**
   * @param {Record<string, unknown>} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async updateSingleOccurrence(input) {
    const repository = this.getRecurrenceRepository(["createRecurrenceException"]);
    const occurrence = normalizeOccurrenceReference(input);
    const override = normalizeOccurrenceOverride(input);
    const rule = normalizeRecurrenceRule({
      ...input,
      endDate: occurrence.date,
      maxOccurrences: 1,
      startDate: override.date || occurrence.date,
      startTime: override.startTime || occurrence.startTime,
    });
    const work = async (agendaRepository = repository) => {
      const validation = await this.validateRecurrenceConflicts(rule, input, agendaRepository);

      if (!validation.canConfirm) {
        throw controlledError(
          "Ocorrencia recorrente possui conflitos criticos.",
          AGENDA_CONFLICT_VALIDATION_FAILED_CODE,
          { validation },
        );
      }

      const exception = await agendaRepository.createRecurrenceException({
        exceptionType: RECURRENCE_EXCEPTION_TYPES.MODIFIED,
        occurrence,
        override,
        reason: nullableText(input.reason, 500),
        requestedBy: nullableText(input.requestedBy, 191),
        scope: RECURRENCE_OPERATION_SCOPES.THIS_OCCURRENCE,
        seriesId: input.seriesId,
      });

      return buildRecurrenceOperationResult({
        agendaConflictValidation: validation,
        exception,
        occurrence,
        recurrenceUpdated: true,
        scope: RECURRENCE_OPERATION_SCOPES.THIS_OCCURRENCE,
      });
    };

    return this.withRecurrenceTransaction(repository, work);
  }

  /**
   * @param {Record<string, unknown>} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async updateThisAndFollowing(input) {
    const repository = this.getRecurrenceRepository(["splitRecurrenceSeries"]);
    const occurrence = normalizeOccurrenceReference(input);
    const ruleChanges = normalizeRecurrenceRuleChanges(input);
    const splitStartDate = occurrence.date;
    const validationRule = normalizeRecurrenceRule({
      ...input,
      ...ruleChanges,
      startDate: splitStartDate,
    });
    const work = async (agendaRepository = repository) => {
      const validation = await this.validateRecurrenceConflicts(validationRule, input, agendaRepository);

      if (!validation.canConfirm) {
        throw controlledError(
          "Proximas ocorrencias da recorrencia possuem conflitos criticos.",
          AGENDA_CONFLICT_VALIDATION_FAILED_CODE,
          { validation },
        );
      }

      const split = await agendaRepository.splitRecurrenceSeries({
        changes: ruleChanges,
        occurrence,
        reason: nullableText(input.reason, 500),
        requestedBy: nullableText(input.requestedBy, 191),
        seriesId: input.seriesId,
      });

      return buildRecurrenceOperationResult({
        agendaConflictValidation: validation,
        occurrence,
        recurrenceSplit: true,
        recurrenceUpdated: true,
        scope: RECURRENCE_OPERATION_SCOPES.THIS_AND_FOLLOWING,
        split,
      });
    };

    return this.withRecurrenceTransaction(repository, work);
  }

  /**
   * @param {Record<string, unknown>} input
   * @returns {Promise<Record<string, unknown>>}
   */
  async updateSeries(input) {
    const repository = this.getRecurrenceRepository(["updateRecurrenceSeries"]);
    const ruleChanges = normalizeRecurrenceRuleChanges(input);
    const validationRule = normalizeRecurrenceRule({ ...input, ...ruleChanges });
    const work = async (agendaRepository = repository) => {
      const validation = await this.validateRecurrenceConflicts(validationRule, input, agendaRepository);

      if (!validation.canConfirm) {
        throw controlledError(
          "Serie de recorrencia possui conflitos criticos.",
          AGENDA_CONFLICT_VALIDATION_FAILED_CODE,
          { validation },
        );
      }

      const series = await agendaRepository.updateRecurrenceSeries({
        changes: ruleChanges,
        reason: nullableText(input.reason, 500),
        requestedBy: nullableText(input.requestedBy, 191),
        seriesId: input.seriesId,
      });

      return buildRecurrenceOperationResult({
        agendaConflictValidation: validation,
        recurrenceUpdated: true,
        scope: RECURRENCE_OPERATION_SCOPES.SERIES,
        series,
      });
    };

    return this.withRecurrenceTransaction(repository, work);
  }

  /**
   * @param {Record<string, unknown>} rule
   * @param {Record<string, unknown>} input
   * @param {Record<string, Function>|null} repository
   * @returns {Promise<Record<string, unknown>>}
   */
  async validateRecurrenceConflicts(rule, input = {}, repository = this.agendaRepository) {
    if (input.skipConflictValidation === true) {
      return {
        canConfirm: true,
        checkedOccurrences: [],
        conflictDetected: false,
        conflicts: [],
        skipped: true,
      };
    }

    const generation = generateRecurrenceOccurrences(rule, {
      endDate: input.conflictValidationEndDate || input.endDate,
      limit: input.conflictValidationLimit || Math.min(rule.maxOccurrences || 12, 24),
      startDate: input.conflictValidationStartDate || input.startDate,
    });
    const validator =
      this.conflictValidationService ||
      new AgendaConflictValidationService({
        agendaRepository: repository,
        classFacade: this.classFacade,
      });
    const validationResults = [];

    for (const occurrence of generation.occurrences) {
      const validation = await validator.validateAgendaEvent({
        ...rule,
        ...occurrence.schedule,
        action: input.action || "CREATE",
        blockOnWarnings: input.blockOnWarnings,
        calendarEventId: occurrence.id,
        date: occurrence.date,
        eventId: occurrence.id,
        isRecurringProjection: true,
        recurrenceUpdateScope: input.scope || input.recurrenceUpdateScope || RECURRENCE_OPERATION_SCOPES.SERIES,
      });

      validationResults.push(validation);
    }

    const conflicts = validationResults.flatMap((validation) =>
      Array.isArray(validation.conflicts) ? validation.conflicts : [],
    );
    const criticalConflicts = conflicts.filter((conflict) => conflict.blocking !== false);

    return {
      canConfirm: criticalConflicts.length === 0,
      checkedOccurrences: generation.occurrences,
      conflictDetected: conflicts.length > 0,
      conflicts,
      criticalConflicts,
      recurrenceConflictValidationEnabled: true,
      truncated: generation.truncated,
      warnings: conflicts.filter((conflict) => conflict.blocking === false),
    };
  }

  /**
   * @param {string[]} methods
   * @returns {Record<string, Function>}
   */
  getRecurrenceRepository(methods = []) {
    const repository = this.agendaRepository;

    if (!repository || typeof repository !== "object") {
      throw controlledError(
        "AgendaRecurrenceService requires an agendaRepository.",
        AGENDA_RECURRENCE_REPOSITORY_REQUIRED_CODE,
      );
    }

    for (const method of methods) {
      if (typeof repository[method] !== "function") {
        throw controlledError(
          `AgendaRecurrenceService requires agendaRepository.${method}.`,
          AGENDA_RECURRENCE_REPOSITORY_REQUIRED_CODE,
          { method },
        );
      }
    }

    return repository;
  }

  /**
   * @param {Record<string, Function>} repository
   * @param {(repository?: Record<string, Function>) => Promise<Record<string, unknown>>} work
   * @returns {Promise<Record<string, unknown>>}
   */
  withRecurrenceTransaction(repository, work) {
    if (typeof repository.withAgendaTransaction === "function") {
      return repository.withAgendaTransaction(work);
    }

    return work(repository);
  }
}

/**
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
function normalizeRecurrenceRule(input = {}) {
  const source = readObject(input);
  const startDate = normalizeDateString(
    source.startDate ||
      source.recurrenceStartDate ||
      source.fromDate ||
      source.scheduleDate ||
      source.date,
  );
  const startTime = normalizeTime(source.startTime || source.fromStartTime || source.toStartTime);
  const frequency = normalizeFrequency(source.frequency || source.recurrenceType || source.recurrence);
  const endTime = normalizeTime(source.endTime || source.fromEndTime || source.toEndTime);

  if (!startDate) {
    throw controlledError(
      "Data inicial da recorrencia e obrigatoria.",
      AGENDA_RECURRENCE_RULE_INVALID_CODE,
      { field: "startDate" },
    );
  }

  if (!startTime) {
    throw controlledError(
      "Horario inicial da recorrencia e obrigatorio.",
      AGENDA_RECURRENCE_RULE_INVALID_CODE,
      { field: "startTime" },
    );
  }

  if (endTime && toTimeMinutes(startTime) >= toTimeMinutes(endTime)) {
    throw controlledError(
      "Horario final da recorrencia deve ser maior que o horario inicial.",
      AGENDA_RECURRENCE_RULE_INVALID_CODE,
      { field: "endTime" },
    );
  }

  const rawInterval = normalizePositiveInteger(
    source.intervalValue || source.interval || source.every || source.customInterval,
  );
  const intervalUnit = normalizeIntervalUnit(
    source.intervalUnit || source.customIntervalUnit || defaultIntervalUnitForFrequency(frequency),
  );
  const daysOfWeek = normalizeWeekdayList(
    source.daysOfWeek || source.days_of_week || source.weekdays || source.dayOfWeek,
  );
  const normalizedRule = {
    agendaItemId: nullableText(source.agendaItemId || source.agenda_item_id, 64),
    classId: nullableText(source.classId || source.class_id, 64),
    classLinkId: nullableText(source.classLinkId || source.class_link_id, 64),
    courtId: nullableText(source.courtId || source.quadraId, 64),
    courtName: nullableText(source.courtName || source.quadraName, 191),
    daysOfWeek,
    endDate: normalizeDateString(source.endDate || source.untilDate || source.recurrenceEndDate),
    endTime,
    enrollmentId: nullableText(source.enrollmentId || source.enrollment_id, 64),
    exceptions: normalizeRecurrenceExceptions(source.exceptions),
    frequency,
    id: nullableText(source.id || source.seriesId || source.recurrenceSeriesId, 64),
    intervalUnit,
    intervalValue: readIntervalValue(frequency, rawInterval, intervalUnit),
    maxOccurrences: normalizePositiveInteger(
      source.maxOccurrences || source.recurrenceMaxOccurrences || source.count,
    ),
    metadata: readObject(source.metadata),
    parentSeriesId: nullableText(source.parentSeriesId || source.parent_series_id, 64),
    professorId: nullableText(source.professorId || source.professor_id, 64),
    professorName: nullableText(source.professorName || source.professor_name, 191),
    source: nullableText(source.source, 50) || "AGENDA_ADMIN",
    startDate,
    startTime,
    status: normalizeUpper(source.status || ACTIVE_RECURRENCE_STATUS) || ACTIVE_RECURRENCE_STATUS,
    studentPersonId: nullableText(source.studentPersonId || source.student_person_id, 64),
    studentProfileId: nullableText(source.studentProfileId || source.student_profile_id, 64),
    timezone: nullableText(source.timezone, 64) || DEFAULT_TIMEZONE,
  };

  if (
    [RECURRENCE_FREQUENCIES.WEEKLY, RECURRENCE_FREQUENCIES.BIWEEKLY].includes(frequency) &&
    normalizedRule.daysOfWeek.length === 0
  ) {
    normalizedRule.daysOfWeek = [parseDateDayOfWeek(startDate)];
  }

  if (
    frequency === RECURRENCE_FREQUENCIES.CUSTOM &&
    normalizedRule.intervalUnit === RECURRENCE_INTERVAL_UNITS.WEEK &&
    normalizedRule.daysOfWeek.length === 0
  ) {
    normalizedRule.daysOfWeek = [parseDateDayOfWeek(startDate)];
  }

  if (normalizedRule.endDate && normalizedRule.endDate < normalizedRule.startDate) {
    throw controlledError(
      "Data final da recorrencia nao pode ser anterior a data inicial.",
      AGENDA_RECURRENCE_RULE_INVALID_CODE,
      { field: "endDate" },
    );
  }

  return normalizedRule;
}

/**
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
function normalizeRecurrenceRuleChanges(input = {}) {
  const source = readObject(input);
  const changes = {};

  for (const [targetKey, sourceKeys] of Object.entries({
    courtId: ["courtId", "quadraId"],
    courtName: ["courtName", "quadraName"],
    daysOfWeek: ["daysOfWeek", "weekdays"],
    endDate: ["endDate", "untilDate", "recurrenceEndDate"],
    endTime: ["endTime", "toEndTime"],
    frequency: ["frequency", "recurrenceType", "recurrence"],
    intervalUnit: ["intervalUnit", "customIntervalUnit"],
    intervalValue: ["intervalValue", "interval", "every", "customInterval"],
    maxOccurrences: ["maxOccurrences", "recurrenceMaxOccurrences", "count"],
    professorId: ["professorId"],
    professorName: ["professorName"],
    startDate: ["startDate", "recurrenceStartDate"],
    startTime: ["startTime", "toStartTime"],
  })) {
    const value = readFirstDefined(source, sourceKeys);
    if (value !== undefined) {
      changes[targetKey] = value;
    }
  }

  if (Object.keys(changes).length === 0) {
    throw controlledError(
      "Nenhuma alteracao de recorrencia foi informada.",
      AGENDA_RECURRENCE_RULE_INVALID_CODE,
    );
  }

  return changes;
}

/**
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 */
function normalizeOccurrenceOverride(input = {}) {
  const source = readObject(input);
  const override = {
    courtId: nullableText(source.courtId || source.quadraId, 64),
    courtName: nullableText(source.courtName || source.quadraName, 191),
    date: normalizeDateString(source.toDate || source.date || source.scheduleDate),
    endTime: normalizeTime(source.toEndTime || source.endTime),
    professorId: nullableText(source.professorId, 64),
    professorName: nullableText(source.professorName, 191),
    startTime: normalizeTime(source.toStartTime || source.startTime),
  };

  return Object.fromEntries(
    Object.entries(override).filter(([, value]) => value !== null && value !== undefined),
  );
}

/**
 * @param {Record<string, unknown>} input
 * @returns {{ date: string, key: string, startTime: string|null }}
 */
function normalizeOccurrenceReference(input = {}) {
  const date = normalizeDateString(
    input.occurrenceDate || input.date || input.fromDate || input.scheduleDate,
  );
  const startTime = normalizeTime(input.occurrenceStartTime || input.fromStartTime || input.startTime);
  const rawKey = nullableText(input.occurrenceKey || input.recurrenceOccurrenceKey, 191);
  const key = rawKey || (date ? buildRecurrenceOccurrenceKey(input.seriesId, date, startTime) : null);

  if (!date || !key) {
    throw controlledError(
      "Ocorrencia da recorrencia precisa de occurrenceDate ou occurrenceKey.",
      AGENDA_RECURRENCE_OCCURRENCE_REQUIRED_CODE,
    );
  }

  return {
    date,
    key,
    startTime,
  };
}

/**
 * @param {Record<string, unknown>} rule
 * @param {Object} [options]
 * @returns {{ occurrences: Record<string, unknown>[], truncated: boolean }}
 */
function generateRecurrenceOccurrences(rule, options = {}) {
  const normalizedRule = normalizeRecurrenceRule(rule);
  const optionStart = normalizeDateString(options.startDate) || normalizedRule.startDate;
  const optionEnd = normalizeDateString(options.endDate);
  const limit = Math.min(
    normalizePositiveInteger(options.limit) || normalizedRule.maxOccurrences || DEFAULT_PREVIEW_LIMIT,
    MAX_GENERATION_LIMIT,
  );
  const hardEnd =
    minDateString(optionEnd, normalizedRule.endDate) ||
    addYears(normalizedRule.startDate, Math.min(Math.ceil(limit / 12) + 1, 25));
  const maxOccurrences = normalizedRule.maxOccurrences
    ? Math.min(normalizedRule.maxOccurrences, limit)
    : limit;
  const exceptions = normalizeRecurrenceExceptions(options.exceptions || normalizedRule.exceptions);
  const exceptionsByKey = new Map(exceptions.map((exception) => [exception.occurrenceKey, exception]));
  const occurrences = [];
  let matchedCount = 0;
  let cursor = parseDate(normalizedRule.startDate);
  const endDate = parseDate(hardEnd);
  const startWindow = parseDate(optionStart);
  let iterations = 0;
  let truncated = false;

  while (cursor <= endDate && iterations < MAX_GENERATION_LIMIT) {
    iterations += 1;
    const dateKey = formatDateKey(cursor);

    if (dateMatchesRule(normalizedRule, cursor)) {
      matchedCount += 1;

      if (matchedCount > maxOccurrences) {
        truncated = !normalizedRule.maxOccurrences || limit < normalizedRule.maxOccurrences;
        break;
      }

      if (cursor >= startWindow) {
        const occurrenceKey = buildRecurrenceOccurrenceKey(
          normalizedRule.id,
          dateKey,
          normalizedRule.startTime,
        );
        const exception = exceptionsByKey.get(occurrenceKey);
        const occurrence = buildOccurrence(normalizedRule, {
          date: dateKey,
          exception,
          occurrenceIndex: matchedCount,
          occurrenceKey,
        });

        if (occurrence.status !== CANCELLED_RECURRENCE_STATUS || options.includeCancelled === true) {
          occurrences.push(occurrence);
        }
      }
    }

    if (occurrences.length >= limit) {
      truncated = true;
      break;
    }

    cursor = addDays(cursor, 1);
  }

  if (iterations >= MAX_GENERATION_LIMIT) {
    truncated = true;
  }

  return {
    occurrences: dedupeOccurrences(occurrences),
    truncated,
  };
}

/**
 * @param {Record<string, unknown>} rule
 * @param {{ date: string, exception?: Record<string, unknown>|null, occurrenceIndex: number, occurrenceKey: string }} input
 * @returns {Record<string, unknown>}
 */
function buildOccurrence(rule, { date, exception = null, occurrenceIndex, occurrenceKey }) {
  const override = readObject(exception?.override);
  const occurrenceDate = normalizeDateString(override.date) || date;
  const startTime = normalizeTime(override.startTime) || rule.startTime;
  const endTime = normalizeTime(override.endTime) || rule.endTime;
  const status =
    exception?.exceptionType === RECURRENCE_EXCEPTION_TYPES.CANCELLED
      ? CANCELLED_RECURRENCE_STATUS
      : ACTIVE_RECURRENCE_STATUS;
  const effectiveKey = buildRecurrenceOccurrenceKey(rule.id, occurrenceDate, startTime);
  const schedule = {
    agendaItemId: rule.agendaItemId || null,
    classId: rule.classId || null,
    courtId: override.courtId || rule.courtId || null,
    courtName: override.courtName || rule.courtName || null,
    dayOfWeek: parseDateDayOfWeek(occurrenceDate),
    endTime,
    enrollmentId: rule.enrollmentId || null,
    isRecurringProjection: true,
    professorId: override.professorId || rule.professorId || null,
    professorName: override.professorName || rule.professorName || null,
    recurrenceExceptionType: exception?.exceptionType || null,
    recurrenceFrequency: rule.frequency,
    recurrenceOccurrenceKey: occurrenceKey,
    recurrenceSeriesId: rule.id || null,
    recurrenceType: rule.frequency,
    scheduleDate: occurrenceDate,
    startTime,
    status,
    studentPersonId: rule.studentPersonId || null,
    studentProfileId: rule.studentProfileId || null,
  };

  return {
    date: occurrenceDate,
    endTime,
    exceptionType: exception?.exceptionType || null,
    id: effectiveKey,
    isException: Boolean(exception),
    isRecurringProjection: true,
    occurrenceIndex,
    occurrenceKey,
    originalDate: date,
    recurrenceSeriesId: rule.id || null,
    schedule,
    startTime,
    status,
  };
}

function dateMatchesRule(rule, date) {
  if (rule.status === CANCELLED_RECURRENCE_STATUS) {
    return false;
  }

  const startDate = parseDate(rule.startDate);

  if (date < startDate) {
    return false;
  }

  if (rule.endDate && date > parseDate(rule.endDate)) {
    return false;
  }

  const diffDays = daysBetween(startDate, date);

  if (rule.frequency === RECURRENCE_FREQUENCIES.DAILY) {
    return diffDays % rule.intervalValue === 0;
  }

  if (rule.frequency === RECURRENCE_FREQUENCIES.WEEKLY) {
    return matchesWeeklyRule(rule, startDate, date, 1);
  }

  if (rule.frequency === RECURRENCE_FREQUENCIES.BIWEEKLY) {
    return matchesWeeklyRule(rule, startDate, date, 2);
  }

  if (rule.frequency === RECURRENCE_FREQUENCIES.MONTHLY) {
    return matchesMonthlyRule(rule, startDate, date, 1);
  }

  if (rule.frequency === RECURRENCE_FREQUENCIES.CUSTOM) {
    if (rule.intervalUnit === RECURRENCE_INTERVAL_UNITS.MONTH) {
      return matchesMonthlyRule(rule, startDate, date, rule.intervalValue);
    }

    if (rule.intervalUnit === RECURRENCE_INTERVAL_UNITS.WEEK) {
      return matchesWeeklyRule(rule, startDate, date, rule.intervalValue);
    }

    return diffDays % rule.intervalValue === 0;
  }

  return false;
}

function matchesWeeklyRule(rule, startDate, date, fallbackInterval) {
  const interval = Math.max(rule.intervalValue || fallbackInterval, fallbackInterval);
  const diffWeeks = Math.floor(daysBetween(startOfWeek(startDate), startOfWeek(date)) / 7);
  const weekdays = rule.daysOfWeek.length > 0 ? rule.daysOfWeek : [startDate.getDay()];

  return diffWeeks % interval === 0 && weekdays.includes(date.getDay());
}

function matchesMonthlyRule(rule, startDate, date, fallbackInterval) {
  const interval = Math.max(rule.intervalValue || fallbackInterval, fallbackInterval);
  const diffMonths = monthsBetween(startDate, date);

  if (diffMonths % interval !== 0) {
    return false;
  }

  return date.getDate() === clampDayOfMonth(date.getFullYear(), date.getMonth(), startDate.getDate());
}

function buildRecurrenceOperationResult({
  agendaConflictValidation = null,
  exception = null,
  exceptions = [],
  occurrence = null,
  occurrences = [],
  recurrenceCancelled = false,
  recurrenceCreated = false,
  recurrenceLoaded = false,
  recurrencePreview = false,
  recurrenceSplit = false,
  recurrenceUpdated = false,
  rule = null,
  scope = null,
  series = null,
  split = null,
  truncated = false,
} = {}) {
  return {
    agendaConflictValidation,
    exception,
    exceptions,
    noAttendanceCreated: true,
    noDuplicateOccurrences: true,
    noFinancialSideEffects: true,
    noNotificationSideEffects: true,
    occurrence,
    occurrenceCount: occurrences.length,
    occurrences,
    recurrenceCancelled,
    recurrenceCreated,
    recurrenceLoaded,
    recurrencePreview,
    recurrenceSplit,
    recurrenceUpdated,
    rule,
    scope,
    series,
    split,
    truncated,
  };
}

function normalizeRecurrenceExceptions(value) {
  return normalizeObjectArray(value).map((item) => {
    const occurrence = normalizeOccurrenceReference({
      occurrenceDate: item.occurrenceDate || item.occurrence_date,
      occurrenceKey: item.occurrenceKey || item.occurrence_key,
      occurrenceStartTime: item.occurrenceStartTime || item.occurrence_start_time,
      seriesId: item.seriesId || item.series_id,
    });

    return {
      createdAt: item.createdAt || item.created_at || null,
      exceptionType: normalizeUpper(item.exceptionType || item.exception_type) ||
        RECURRENCE_EXCEPTION_TYPES.MODIFIED,
      id: nullableText(item.id, 64),
      occurrenceDate: occurrence.date,
      occurrenceKey: occurrence.key,
      occurrenceStartTime: occurrence.startTime,
      override: readObject(item.override || item.overrideJson || item.override_json),
      reason: nullableText(item.reason, 500),
      seriesId: nullableText(item.seriesId || item.series_id, 64),
    };
  });
}

function normalizeFrequency(value) {
  const normalized = normalizeUpper(value || RECURRENCE_FREQUENCIES.WEEKLY);

  if (normalized === "QUINZENAL" || normalized === "BI_WEEKLY" || normalized === "FORTNIGHTLY") {
    return RECURRENCE_FREQUENCIES.BIWEEKLY;
  }

  if (normalized === "DIARIA" || normalized === "DAILY") {
    return RECURRENCE_FREQUENCIES.DAILY;
  }

  if (normalized === "SEMANAL" || normalized === "WEEKLY") {
    return RECURRENCE_FREQUENCIES.WEEKLY;
  }

  if (normalized === "MENSAL" || normalized === "MONTHLY") {
    return RECURRENCE_FREQUENCIES.MONTHLY;
  }

  if (normalized === "PERSONALIZADA" || normalized === "CUSTOM") {
    return RECURRENCE_FREQUENCIES.CUSTOM;
  }

  if (Object.values(RECURRENCE_FREQUENCIES).includes(normalized)) {
    return normalized;
  }

  throw controlledError(
    "Tipo de recorrencia invalido.",
    AGENDA_RECURRENCE_RULE_INVALID_CODE,
    { frequency: value },
  );
}

function normalizeIntervalUnit(value) {
  const normalized = normalizeUpper(value || RECURRENCE_INTERVAL_UNITS.WEEK);

  if (["DIA", "DIAS", "DAY", "DAYS"].includes(normalized)) {
    return RECURRENCE_INTERVAL_UNITS.DAY;
  }

  if (["SEMANA", "SEMANAS", "WEEK", "WEEKS"].includes(normalized)) {
    return RECURRENCE_INTERVAL_UNITS.WEEK;
  }

  if (["MES", "MESES", "MONTH", "MONTHS"].includes(normalized)) {
    return RECURRENCE_INTERVAL_UNITS.MONTH;
  }

  return RECURRENCE_INTERVAL_UNITS.WEEK;
}

function defaultIntervalUnitForFrequency(frequency) {
  if (frequency === RECURRENCE_FREQUENCIES.DAILY) {
    return RECURRENCE_INTERVAL_UNITS.DAY;
  }

  if (frequency === RECURRENCE_FREQUENCIES.MONTHLY) {
    return RECURRENCE_INTERVAL_UNITS.MONTH;
  }

  return RECURRENCE_INTERVAL_UNITS.WEEK;
}

function readIntervalValue(frequency, rawInterval, intervalUnit) {
  if (frequency === RECURRENCE_FREQUENCIES.BIWEEKLY) {
    return 2;
  }

  if (frequency === RECURRENCE_FREQUENCIES.CUSTOM) {
    return rawInterval || (intervalUnit === RECURRENCE_INTERVAL_UNITS.WEEK ? 1 : 1);
  }

  return rawInterval || 1;
}

function normalizeOperationScope(value) {
  const normalized = normalizeUpper(value || RECURRENCE_OPERATION_SCOPES.THIS_OCCURRENCE);
  const aliases = {
    ALL: RECURRENCE_OPERATION_SCOPES.SERIES,
    FUTURE: RECURRENCE_OPERATION_SCOPES.THIS_AND_FOLLOWING,
    INSTANCE: RECURRENCE_OPERATION_SCOPES.THIS_OCCURRENCE,
    OCCURRENCE: RECURRENCE_OPERATION_SCOPES.THIS_OCCURRENCE,
    SERIES: RECURRENCE_OPERATION_SCOPES.SERIES,
    THIS_AND_FOLLOWING: RECURRENCE_OPERATION_SCOPES.THIS_AND_FOLLOWING,
    THIS_OCCURRENCE: RECURRENCE_OPERATION_SCOPES.THIS_OCCURRENCE,
  };

  return aliases[normalized] || normalized;
}

function normalizeWeekdayList(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];

  return Array.from(
    new Set(
      values
        .flatMap((item) => String(item ?? "").split(/[\/,;|]/g))
        .map(parseWeekdayIndex)
        .filter((day) => Number.isInteger(day)),
    ),
  ).sort((left, right) => left - right);
}

function parseWeekdayIndex(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value === 7) return 0;
    return value >= 0 && value <= 6 ? value : null;
  }

  const normalized = normalizeComparable(value);

  if (!normalized) {
    return null;
  }

  return WEEKDAY_ALIASES.get(normalized) ?? null;
}

function buildRecurrenceOccurrenceKey(seriesId, date, startTime = null) {
  return [seriesId || "recurrence", date, startTime || ""].join(":");
}

function buildRecurrenceIdempotencyKey(rule) {
  return [
    "agenda-recurrence",
    rule.agendaItemId || "",
    rule.enrollmentId || "",
    rule.classId || "",
    rule.frequency,
    rule.intervalValue,
    rule.intervalUnit,
    rule.daysOfWeek.join(","),
    rule.startDate,
    rule.endDate || "",
    rule.maxOccurrences || "",
    rule.startTime,
    rule.endTime || "",
  ].join(":");
}

function buildStableId(prefix, value) {
  return `${prefix}_${crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 24)}`;
}

function dedupeOccurrences(occurrences) {
  return Array.from(new Map(occurrences.map((occurrence) => [occurrence.id, occurrence])).values());
}

function normalizeObjectArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readFirstDefined(source, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key];
    }
  }

  return undefined;
}

function normalizePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeDateString(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateKey(value);
  }

  const normalized = nullableText(value, 32);

  if (!normalized) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);

  if (!match) {
    return null;
  }

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== Number(match[1]) ||
    parsed.getMonth() + 1 !== Number(match[2]) ||
    parsed.getDate() !== Number(match[3])
  ) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseDate(value) {
  const normalized = normalizeDateString(value);

  if (!normalized) {
    throw controlledError(
      "Data invalida para recorrencia.",
      AGENDA_RECURRENCE_RULE_INVALID_CODE,
      { value },
    );
  }

  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(date, amount) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

function addYears(dateString, amount) {
  const date = parseDate(dateString);
  date.setFullYear(date.getFullYear() + amount);
  return formatDateKey(date);
}

function startOfWeek(date) {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  normalized.setDate(normalized.getDate() - normalized.getDay());
  return normalized;
}

function daysBetween(start, end) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor(
    (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      msPerDay,
  );
}

function monthsBetween(start, end) {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function clampDayOfMonth(year, month, day) {
  return Math.min(day, new Date(year, month + 1, 0).getDate());
}

function minDateString(...values) {
  const dates = values.map(normalizeDateString).filter(Boolean);
  return dates.length > 0 ? dates.sort()[0] : null;
}

function parseDateDayOfWeek(dateString) {
  return parseDate(dateString).getDay();
}

function normalizeTime(value) {
  const normalized = nullableText(value, 20);
  const match = /^(\d{1,2}):(\d{2})/.exec(normalized || "");

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toTimeMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));

  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeUpper(value) {
  const normalized = nullableText(value, 64);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeComparable(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);

  if (!normalized) {
    const code =
      field === "seriesId"
        ? AGENDA_RECURRENCE_SERIES_ID_REQUIRED_CODE
        : AGENDA_RECURRENCE_RULE_INVALID_CODE;
    throw controlledError(`AgendaRecurrenceService requires ${field}.`, code, { field });
  }

  return normalized;
}

function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

module.exports = {
  ACTIVE_RECURRENCE_STATUS,
  AGENDA_RECURRENCE_NOT_FOUND_CODE,
  AGENDA_RECURRENCE_OCCURRENCE_REQUIRED_CODE,
  AGENDA_RECURRENCE_REPOSITORY_REQUIRED_CODE,
  AGENDA_RECURRENCE_RULE_INVALID_CODE,
  AGENDA_RECURRENCE_SCOPE_INVALID_CODE,
  AGENDA_RECURRENCE_SERIES_ID_REQUIRED_CODE,
  CANCELLED_RECURRENCE_STATUS,
  DEFAULT_TIMEZONE,
  RECURRENCE_EXCEPTION_TYPES,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_INTERVAL_UNITS,
  RECURRENCE_OPERATION_SCOPES,
  WEEKDAY_LABELS,
  AgendaRecurrenceService,
  buildRecurrenceIdempotencyKey,
  buildRecurrenceOccurrenceKey,
  buildStableId,
  generateRecurrenceOccurrences,
  normalizeOccurrenceReference,
  normalizeRecurrenceRule,
  normalizeRecurrenceRuleChanges,
};
