const { CreateEnrollmentRequest } = require("../dtos/create-enrollment-request.dto.js");

const REQUIRED_RELATIONSHIP_FLAGS = Object.freeze([
  "responsavelLegal",
  "financeiro",
  "recebeComunicados",
  "podeBuscar",
  "emergencia",
]);

/**
 * Validates CreateEnrollmentCommand before the enrollment flow runs.
 *
 * This validator mirrors the existing Sprint 9.5 checks. It does not access
 * repositories, database, SQL, APIs, frontend modules or domain events.
 */
class CreateEnrollmentValidator {
  /**
   * @param {import("../commands/create-enrollment.command.js").CreateEnrollmentCommand} command
   * @returns {{ isValid: boolean, errors: Array<{ field: string, message: string, code: string }>, warnings: Array<{ field: string, message: string, code: string }> }}
   */
  validate(command) {
    const request = new CreateEnrollmentRequest(getCommandPayload(command));
    const errors = validateRequest(request);
    const warnings = buildWarnings(request);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * @param {import("../commands/create-enrollment.command.js").CreateEnrollmentCommand|unknown} command
 * @returns {unknown}
 */
function getCommandPayload(command) {
  return typeof command?.getPayload === "function" ? command.getPayload() : command;
}

/**
 * @param {CreateEnrollmentRequest} request
 * @returns {Array<{ field: string, message: string, code: string }>}
 */
function validateRequest(request) {
  const errors = [];

  if (!request.raw || typeof request.raw !== "object" || Array.isArray(request.raw)) {
    errors.push(error("payload", "Payload must be an object.", "INVALID_PAYLOAD"));
    return errors;
  }

  validateStudent(request.aluno, errors);
  validateResponsibles(request.responsaveis, errors);
  validateEnrollment(request.matricula, errors);

  return errors;
}

/**
 * @param {Record<string, unknown>} aluno
 * @param {Array<{ field: string, message: string, code: string }>} errors
 */
function validateStudent(aluno, errors) {
  if (!hasKeys(aluno)) {
    errors.push(error("aluno", "Student data is required.", "STUDENT_REQUIRED"));
    return;
  }

  requireText(aluno.nome, "aluno.nome", "Student name is required.", "STUDENT_NAME_REQUIRED", errors);
  requireText(
    aluno.dataNascimento,
    "aluno.dataNascimento",
    "Student birth date is required.",
    "STUDENT_BIRTH_DATE_REQUIRED",
    errors,
  );
  requireText(aluno.sexo, "aluno.sexo", "Student sex is required.", "STUDENT_SEX_REQUIRED", errors);
}

/**
 * @param {Record<string, unknown>[]} responsaveis
 * @param {Array<{ field: string, message: string, code: string }>} errors
 */
function validateResponsibles(responsaveis, errors) {
  if (!Array.isArray(responsaveis) || responsaveis.length === 0) {
    errors.push(error("responsaveis", "At least one responsible person is required.", "RESPONSIBLE_REQUIRED"));
    return;
  }

  responsaveis.forEach((responsavel, index) => {
    const prefix = `responsaveis[${index}]`;
    const relacionamento = normalizeRelationship(responsavel.relacionamento);

    requireText(
      responsavel.nome,
      `${prefix}.nome`,
      "Responsible person name is required.",
      "RESPONSIBLE_NAME_REQUIRED",
      errors,
    );
    requireText(
      relacionamento.tipo,
      `${prefix}.relacionamento.tipo`,
      "Relationship type is required.",
      "RELATIONSHIP_TYPE_REQUIRED",
      errors,
    );

    if (!hasAnyRelationshipFlag(relacionamento)) {
      errors.push(
        error(
          `${prefix}.relacionamento`,
          "At least one relationship responsibility flag is required.",
          "RELATIONSHIP_FLAG_REQUIRED",
        ),
      );
    }

    if (relacionamento.financeiroPrincipal === true && relacionamento.financeiro !== true) {
      errors.push(
        error(
          `${prefix}.relacionamento.financeiroPrincipal`,
          "financial main responsibility requires financeiro=true.",
          "FINANCIAL_MAIN_REQUIRES_FINANCIAL",
        ),
      );
    }

    if (relacionamento.emergenciaPrincipal === true && relacionamento.emergencia !== true) {
      errors.push(
        error(
          `${prefix}.relacionamento.emergenciaPrincipal`,
          "main emergency contact requires emergencia=true.",
          "EMERGENCY_MAIN_REQUIRES_EMERGENCY",
        ),
      );
    }
  });
}

/**
 * @param {Record<string, unknown>} matricula
 * @param {Array<{ field: string, message: string, code: string }>} errors
 */
function validateEnrollment(matricula, errors) {
  if (!hasKeys(matricula)) {
    errors.push(error("matricula", "Enrollment data is required.", "ENROLLMENT_REQUIRED"));
    return;
  }

  requireText(
    matricula.dataMatricula,
    "matricula.dataMatricula",
    "Enrollment date is required.",
    "ENROLLMENT_DATE_REQUIRED",
    errors,
  );
  requireText(
    matricula.statusInicial,
    "matricula.statusInicial",
    "Initial enrollment status is required.",
    "ENROLLMENT_STATUS_REQUIRED",
    errors,
  );
}

/**
 * @param {CreateEnrollmentRequest} request
 * @returns {Array<{ field: string, message: string, code: string }>}
 */
function buildWarnings(request) {
  const warnings = [];

  if (request.responsaveis.length > 1) {
    warnings.push(
      error(
        "responsaveis",
        "Sprint 9.3 creates only the first responsible person; additional responsible people remain pending.",
        "MULTIPLE_RESPONSIBLES_FIRST_ONLY",
      ),
    );
  }

  return warnings;
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function normalizeRelationship(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * @param {Record<string, unknown>} relationship
 * @returns {boolean}
 */
function hasAnyRelationshipFlag(relationship) {
  return REQUIRED_RELATIONSHIP_FLAGS.some((flag) => relationship[flag] === true);
}

/**
 * @param {Record<string, unknown>} value
 * @returns {boolean}
 */
function hasKeys(value) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function text(value) {
  return String(value ?? "").trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {string} message
 * @param {string} code
 * @param {Array<{ field: string, message: string, code: string }>} errors
 */
function requireText(value, field, message, code, errors) {
  if (!text(value)) {
    errors.push(error(field, message, code));
  }
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

module.exports = {
  CreateEnrollmentValidator,
  buildWarnings,
  validateRequest,
};
