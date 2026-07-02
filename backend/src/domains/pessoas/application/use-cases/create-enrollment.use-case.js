const { BaseUseCase } = require("../../../../core/transactions/BaseUseCase.js");
const { CreateEnrollmentCommand } = require("../commands/create-enrollment.command.js");
const { EnrollmentApplicationService } = require("../services/enrollment-application.service.js");
const {
  CreateEnrollmentValidator,
  validateRequest,
} = require("../validators/create-enrollment.validator.js");

const CREATE_RESPONSIBLE_PERSON_STEP = "createResponsiblePerson";
const CREATE_RESPONSIBLE_PROFILE_STEP = "createResponsibleProfile";

/**
 * Executes the approved enrollment steps through EnrollmentApplicationService.
 *
 * Sprint 9.6 validates CreateEnrollmentCommand explicitly before delegating to
 * EnrollmentApplicationService. Sprint 9.9 keeps this use case unaware of
 * repositories and specific application services while the application service
 * resolves the student Pessoa, creates its profile and creates the
 * responsible-student relationship. Sprint 9.15 also returns the in-memory
 * draftEnrollment produced by the pessoas orchestrator, while this use case
 * remains isolated from the enrollments domain internals. It still
 * intentionally does not persist enrollment records, contracts, finance
 * entries or classes.
 */
class CreateEnrollmentUseCase extends BaseUseCase {
  /**
   * @param {Object} [options]
   * @param {EnrollmentApplicationService} [options.enrollmentApplicationService]
   * @param {CreateEnrollmentValidator} [options.createEnrollmentValidator]
   * @param {() => string} [options.clock]
   */
  constructor({
    clock = nowIso,
    createEnrollmentValidator = new CreateEnrollmentValidator(),
    enrollmentApplicationService = new EnrollmentApplicationService({ clock }),
  } = {}) {
    super();
    this.createEnrollmentValidator = createEnrollmentValidator;
    this.enrollmentApplicationService = enrollmentApplicationService;
  }

  /**
   * @param {Record<string, unknown>} input
   * @param {Record<string, unknown>} context
   * @returns {Promise<void>}
   */
  async beforeExecute(input = {}, context = {}) {
    context.command = new CreateEnrollmentCommand(input);
    context.warnings = [];
    context.step = CREATE_RESPONSIBLE_PROFILE_STEP;
  }

  /**
   * @param {Record<string, unknown>} input
   * @param {Record<string, unknown>} context
   * @returns {Promise<void>}
   */
  async validate(input = {}, context = {}) {
    const command = context.command || new CreateEnrollmentCommand(input);
    const validation = this.getCreateEnrollmentValidator().validate(command);

    context.command = command;
    context.validation = validation;
    context.warnings = validation.warnings;

    if (!validation.isValid) {
      throw new UseCaseValidationError(validation.errors);
    }
  }

  /**
   * @param {Record<string, unknown>} input
   * @param {Record<string, unknown>} context
   * @returns {Promise<Record<string, unknown>>}
   */
  async run(input = {}, context = {}) {
    const command = context.command || new CreateEnrollmentCommand(input);
    const enrollment = await this.getEnrollmentApplicationService().createEnrollment(command);

    context.responsiblePerson = enrollment.responsiblePerson;
    context.responsibleProfile = enrollment.responsibleProfile;
    context.studentPerson = enrollment.studentPerson;
    context.studentProfile = enrollment.studentProfile;
    context.responsibleStudentRelationship = enrollment.responsibleStudentRelationship;
    context.draftEnrollment = enrollment.draftEnrollment;
    context.enrollmentCreatedEvent = enrollment.enrollmentCreatedEvent;
    context.warnings = mergeWarnings(context.warnings, enrollment.warnings);

    const data = {
      enrollmentCreatedEvent: enrollment.enrollmentCreatedEvent,
      responsiblePerson: enrollment.responsiblePerson,
      responsibleProfile: enrollment.responsibleProfile,
    };
    const completedStep = readCompletedStep(enrollment);

    if (enrollment.responsibleStudentRelationship) {
      data.responsibleStudentRelationship = enrollment.responsibleStudentRelationship;
    }

    if (enrollment.studentPerson) {
      data.studentPerson = enrollment.studentPerson;
    }

    if (enrollment.studentProfile) {
      data.studentProfile = enrollment.studentProfile;
    }

    if (enrollment.draftEnrollment) {
      data.draftEnrollment = enrollment.draftEnrollment;
    }

    return buildUseCaseResponse({
      data,
      metadata: {
        step: completedStep,
      },
      success: true,
      warnings: context.warnings,
    });
  }

  /**
   * @param {Record<string, unknown>} result
   * @param {Record<string, unknown>} _input
   * @param {Record<string, unknown>} context
   * @returns {Promise<void>}
   */
  async afterExecute(result, _input, context = {}) {
    context.result = result;
    context.completedStep = result?.metadata?.step || CREATE_RESPONSIBLE_PROFILE_STEP;
  }

  /**
   * @param {unknown} error
   * @param {Record<string, unknown>} _input
   * @param {Record<string, unknown>} context
   * @returns {Promise<Record<string, unknown>>}
   */
  async onError(error, _input, context = {}) {
    return buildUseCaseResponse({
      errors: normalizeUseCaseErrors(error),
      metadata: {
        step: context.step || CREATE_RESPONSIBLE_PROFILE_STEP,
      },
      success: false,
      warnings: context.warnings,
    });
  }

  /**
   * @returns {EnrollmentApplicationService}
   */
  getEnrollmentApplicationService() {
    if (typeof this.enrollmentApplicationService?.createEnrollment !== "function") {
      throw new TypeError("CreateEnrollmentUseCase requires an enrollmentApplicationService.createEnrollment function.");
    }

    return this.enrollmentApplicationService;
  }

  /**
   * @returns {CreateEnrollmentValidator}
   */
  getCreateEnrollmentValidator() {
    if (typeof this.createEnrollmentValidator?.validate !== "function") {
      throw new TypeError("CreateEnrollmentUseCase requires a createEnrollmentValidator.validate function.");
    }

    return this.createEnrollmentValidator;
  }
}

class UseCaseValidationError extends Error {
  /**
   * @param {Array<{ field: string, message: string, code: string }>} errors
   */
  constructor(errors) {
    super("CreateEnrollmentUseCase validation failed.");
    this.name = "UseCaseValidationError";
    this.errors = errors;
  }
}

/**
 * @param {Object} input
 * @param {boolean} input.success
 * @param {Record<string, unknown>} [input.data]
 * @param {Array<{ field: string, message: string, code: string }>} [input.warnings]
 * @param {Array<{ field: string, message: string, code: string }>} [input.errors]
 * @param {Record<string, unknown>} [input.metadata]
 * @returns {{ success: boolean, data: Record<string, unknown>, warnings: Array<unknown>, errors: Array<unknown>, metadata: Record<string, unknown> }}
 */
function buildUseCaseResponse({ data = {}, errors = [], metadata = {}, success = false, warnings = [] } = {}) {
  return {
    success: Boolean(success),
    data: data && typeof data === "object" ? data : {},
    warnings: Array.isArray(warnings) ? warnings : [],
    errors: Array.isArray(errors) ? errors : [],
    metadata: {
      step: CREATE_RESPONSIBLE_PROFILE_STEP,
      ...(metadata && typeof metadata === "object" ? metadata : {}),
    },
  };
}

/**
 * @param {unknown} errorValue
 * @returns {Array<{ field: string, message: string, code: string }>}
 */
function normalizeUseCaseErrors(errorValue) {
  if (errorValue instanceof UseCaseValidationError) {
    return errorValue.errors;
  }

  return [
    error(
      "useCase",
      errorValue instanceof Error ? errorValue.message : "Unexpected CreateEnrollmentUseCase error.",
      "CREATE_ENROLLMENT_USE_CASE_ERROR",
    ),
  ];
}

/**
 * @param {Record<string, unknown>} enrollment
 * @returns {string}
 */
function readCompletedStep(enrollment) {
  const step = enrollment?.metadata?.step;
  const normalized = String(step ?? "").trim();

  return normalized || CREATE_RESPONSIBLE_PROFILE_STEP;
}

/**
 * @param {unknown} left
 * @param {unknown} right
 * @returns {Array<unknown>}
 */
function mergeWarnings(left, right) {
  const warnings = [];

  if (Array.isArray(left)) {
    warnings.push(...left);
  }

  if (Array.isArray(right)) {
    warnings.push(...right);
  }

  return warnings;
}

/**
 * @param {string} field
 * @param {string} message
 * @param {string} code
 * @returns {{ field: string, message: string, code: string }}
 */
function error(field, message, code) {
  return { code, field, message };
}

/**
 * @returns {string}
 */
function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  CREATE_RESPONSIBLE_PROFILE_STEP,
  CREATE_RESPONSIBLE_PERSON_STEP,
  CreateEnrollmentUseCase,
  UseCaseValidationError,
  buildUseCaseResponse,
  readCompletedStep,
  validateRequest,
};
