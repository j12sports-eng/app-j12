const {
  PERSON_RELATIONSHIP_STATUS,
  PERSON_RELATIONSHIP_TYPE,
} = require("../../relationships/relationship.types.js");
const { PersonRelationshipRepository } = require("../../relationships/relationship.repository.js");
const { AppError } = require("../../../../errors/app-error.js");

const RELATIONSHIP_APPLICATION_ERROR_CODES = Object.freeze({
  CONFLICT: "RESPONSIBLE_STUDENT_RELATIONSHIP_CONFLICT",
  CREATION_FAILED: "RESPONSIBLE_STUDENT_RELATIONSHIP_CREATION_FAILED",
});

/**
 * Application service responsible for Pessoa relationship operations.
 *
 * Sprint 9.8 only creates a responsible-student relationship when the student
 * Pessoa id is explicitly available in the command payload. It does not create
 * students, enrollments, contracts, finance entries, classes, endpoints or new
 * persistence objects.
 */
class RelationshipApplicationService {
  /**
   * @param {Object} [options]
   * @param {{ create: (payload: Record<string, unknown>) => Promise<unknown> }} [options.personRelationshipRepository]
   */
  constructor({ personRelationshipRepository = null } = {}) {
    this.personRelationshipRepository = personRelationshipRepository;
  }

  /**
   * Creates the Responsavel -> Aluno relationship only when both Pessoa ids are known.
   *
   * @param {Object} input
   * @param {Record<string, unknown>} input.responsiblePerson
   * @param {Record<string, unknown>} input.student
   * @param {Record<string, unknown>} input.responsible
   * @returns {Promise<unknown|null>}
   */
  async createResponsibleStudentRelationship({
    responsible = {},
    responsiblePerson = {},
    student = {},
  } = {}) {
    const responsiblePersonId = readPersonId(responsiblePerson);
    const studentPersonId = readStudentPersonId(student);

    if (!responsiblePersonId) {
      throw new TypeError(
        "RelationshipApplicationService requires a persisted responsible person id.",
      );
    }

    if (!studentPersonId) {
      return null;
    }

    return this.getPersonRelationshipRepository().create(
      buildResponsibleStudentRelationshipPayload({
        relationship: normalizeRelationship(responsible.relacionamento),
        responsiblePersonId,
        studentPersonId,
      }),
    );
  }

  /** Resolves or creates the active Responsavel -> Aluno relationship. */
  async resolveOrCreateResponsibleStudentRelationship({
    relationship = {},
    responsiblePersonId = null,
    studentPersonId = null,
  } = {}) {
    const responsibleId = nullableText(responsiblePersonId);
    const studentId = nullableText(studentPersonId);

    if (!responsibleId || !studentId) {
      throw new TypeError(
        "RelationshipApplicationService requires responsiblePersonId and studentPersonId.",
      );
    }

    const repository = this.getRelationshipResolutionRepository();
    const candidates = await repository.findCandidatesByPeopleAndType(
      responsibleId,
      studentId,
      PERSON_RELATIONSHIP_TYPE.RESPONSIBLE,
    );

    if (candidates.length > 1) {
      throw relationshipError(
        "Responsible-student relationship conflict requires assisted review.",
        RELATIONSHIP_APPLICATION_ERROR_CODES.CONFLICT,
        409,
      );
    }

    if (candidates.length === 1) {
      return relationshipResult(candidates[0], "FOUND", true);
    }

    try {
      const created = await repository.create(
        buildResponsibleStudentRelationshipPayload({
          relationship: normalizeRelationship(relationship),
          responsiblePersonId: responsibleId,
          studentPersonId: studentId,
        }),
      );

      return relationshipResult(created, "CREATED", false);
    } catch {
      throw relationshipError(
        "Responsible-student relationship creation failed.",
        RELATIONSHIP_APPLICATION_ERROR_CODES.CREATION_FAILED,
        500,
      );
    }
  }

  getRelationshipResolutionRepository() {
    const repository = this.getPersonRelationshipRepository();

    if (typeof repository.findCandidatesByPeopleAndType !== "function") {
      throw new TypeError(
        "RelationshipApplicationService requires a personRelationshipRepository.findCandidatesByPeopleAndType function.",
      );
    }

    return repository;
  }

  /**
   * @returns {{ create: (payload: Record<string, unknown>) => Promise<unknown> }}
   */
  getPersonRelationshipRepository() {
    if (!this.personRelationshipRepository) {
      this.personRelationshipRepository = new PersonRelationshipRepository();
    }

    if (typeof this.personRelationshipRepository.create !== "function") {
      throw new TypeError(
        "RelationshipApplicationService requires a personRelationshipRepository.create function.",
      );
    }

    return this.personRelationshipRepository;
  }
}

/**
 * @param {Object} input
 * @param {string} input.responsiblePersonId
 * @param {string} input.studentPersonId
 * @param {Record<string, unknown>} input.relationship
 * @returns {Record<string, unknown>}
 */
function buildResponsibleStudentRelationshipPayload({
  relationship = {},
  responsiblePersonId,
  studentPersonId,
}) {
  return {
    canPickUp: relationship.podeBuscar === true,
    emergencyContact: relationship.emergencia === true,
    financialResponsible: relationship.financeiro === true,
    legalGuardian: relationship.responsavelLegal === true,
    personId: responsiblePersonId,
    receivesNotifications: relationship.recebeComunicados === true,
    relatedPersonId: studentPersonId,
    relationshipLabel: nullableText(relationship.tipo),
    relationshipType: PERSON_RELATIONSHIP_TYPE.RESPONSIBLE,
    status: PERSON_RELATIONSHIP_STATUS.ACTIVE,
  };
}

/**
 * @param {unknown} person
 * @returns {string|null}
 */
function readPersonId(person) {
  const id =
    person && typeof person === "object"
      ? (person.id ?? person.personId ?? person.person_id)
      : null;
  return nullableText(id);
}

/**
 * Reads only explicit Pessoa identifiers for the student.
 *
 * `aluno.id` is intentionally ignored because it can represent a legacy aluno
 * record instead of a Pessoa id.
 *
 * @param {unknown} student
 * @returns {string|null}
 */
function readStudentPersonId(student) {
  const id =
    student && typeof student === "object" ? (student.personId ?? student.person_id) : null;
  return nullableText(id);
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function normalizeRelationship(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function nullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function relationshipResult(relationship, relationshipResolution, reused) {
  const relationshipId =
    relationship && typeof relationship === "object" ? nullableText(relationship.id) : null;

  if (!relationshipId) {
    throw relationshipError(
      "Responsible-student relationship creation failed.",
      RELATIONSHIP_APPLICATION_ERROR_CODES.CREATION_FAILED,
      500,
    );
  }

  return Object.freeze({ relationshipId, relationshipResolution, reused });
}

function relationshipError(message, code, statusCode) {
  return new AppError(message, { code, expose: statusCode < 500, statusCode });
}

module.exports = {
  RELATIONSHIP_APPLICATION_ERROR_CODES,
  RelationshipApplicationService,
  buildResponsibleStudentRelationshipPayload,
  readPersonId,
  readStudentPersonId,
};
