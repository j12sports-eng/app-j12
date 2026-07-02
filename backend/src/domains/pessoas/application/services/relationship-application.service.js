const {
  PERSON_RELATIONSHIP_STATUS,
  PERSON_RELATIONSHIP_TYPE,
} = require("../../relationships/relationship.types.js");
const { PersonRelationshipRepository } = require("../../relationships/relationship.repository.js");

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
  async createResponsibleStudentRelationship({ responsible = {}, responsiblePerson = {}, student = {} } = {}) {
    const responsiblePersonId = readPersonId(responsiblePerson);
    const studentPersonId = readStudentPersonId(student);

    if (!responsiblePersonId) {
      throw new TypeError("RelationshipApplicationService requires a persisted responsible person id.");
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

  /**
   * @returns {{ create: (payload: Record<string, unknown>) => Promise<unknown> }}
   */
  getPersonRelationshipRepository() {
    if (!this.personRelationshipRepository) {
      this.personRelationshipRepository = new PersonRelationshipRepository();
    }

    if (typeof this.personRelationshipRepository.create !== "function") {
      throw new TypeError("RelationshipApplicationService requires a personRelationshipRepository.create function.");
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
function buildResponsibleStudentRelationshipPayload({ relationship = {}, responsiblePersonId, studentPersonId }) {
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
  const id = person && typeof person === "object" ? person.id ?? person.personId ?? person.person_id : null;
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
  const id = student && typeof student === "object" ? student.personId ?? student.person_id : null;
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

module.exports = {
  RelationshipApplicationService,
  buildResponsibleStudentRelationshipPayload,
  readPersonId,
  readStudentPersonId,
};
