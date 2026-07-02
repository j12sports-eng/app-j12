const { PersonApplicationService } = require("./person-application.service.js");
const { ProfileApplicationService } = require("./profile-application.service.js");

const STUDENT_PERSON_STEP = "createStudentPerson";
const STUDENT_PROFILE_STEP = "createStudentProfile";

/**
 * Application service responsible for safe Aluno Pessoa resolution.
 *
 * Sprint 9.9 resolves an existing student Pessoa only from explicit
 * `aluno.personId` or `aluno.person_id`. When that identifier is absent, it
 * creates a new Pessoa through PersonApplicationService and then creates the
 * Aluno profile through ProfileApplicationService.
 */
class StudentApplicationService {
  /**
   * @param {Object} [options]
   * @param {PersonApplicationService} [options.personApplicationService]
   * @param {ProfileApplicationService} [options.profileApplicationService]
   */
  constructor({ personApplicationService = null, profileApplicationService = null } = {}) {
    this.personApplicationService = personApplicationService;
    this.profileApplicationService = profileApplicationService;
  }

  /**
   * Resolves or creates the Pessoa for the student and creates its Aluno profile.
   *
   * @param {Record<string, unknown>} student
   * @returns {Promise<{
   *   createdPerson: boolean,
   *   metadata: Record<string, unknown>,
   *   studentPerson: Record<string, unknown>|unknown|null,
   *   studentPersonId: string|null,
   *   studentProfile: unknown|null,
   *   warnings: Array<{ field: string, message: string, code: string }>
   * }>}
   */
  async resolveStudentPerson(student = {}) {
    const normalizedStudent = normalizeStudent(student);
    const explicitPersonId = readStudentPersonId(normalizedStudent);
    const warnings = [];
    let studentPerson = null;
    let createdPerson = false;

    if (explicitPersonId) {
      studentPerson = buildResolvedStudentPerson(normalizedStudent, explicitPersonId);
    } else {
      const missingFields = getMissingStudentPersonFields(normalizedStudent);

      if (missingFields.length > 0) {
        warnings.push(
          warning(
            "aluno",
            `Student Pessoa was not created because required fields are missing: ${missingFields.join(", ")}.`,
            "STUDENT_PERSON_MINIMUM_DATA_MISSING",
          ),
        );

        return {
          createdPerson: false,
          metadata: {
            step: STUDENT_PERSON_STEP,
          },
          studentPerson: null,
          studentPersonId: null,
          studentProfile: null,
          warnings,
        };
      }

      studentPerson = await this.getPersonApplicationService().createPerson(mapStudentToPersonPayload(normalizedStudent));
      createdPerson = true;
    }

    const studentPersonId = readPersonId(studentPerson);

    if (!studentPersonId) {
      warnings.push(
        warning(
          "aluno.personId",
          "Student Pessoa was resolved without a safe personId; profile and relationship were not created.",
          "STUDENT_PERSON_ID_MISSING",
        ),
      );

      return {
        createdPerson,
        metadata: {
          step: STUDENT_PERSON_STEP,
        },
        studentPerson,
        studentPersonId: null,
        studentProfile: null,
        warnings,
      };
    }

    const studentProfile = await this.getProfileApplicationService().createStudentProfile({
      ...normalizeObject(studentPerson),
      id: studentPersonId,
    });

    return {
      createdPerson,
      metadata: {
        step: STUDENT_PROFILE_STEP,
      },
      studentPerson,
      studentPersonId,
      studentProfile,
      warnings,
    };
  }

  /**
   * @returns {PersonApplicationService}
   */
  getPersonApplicationService() {
    if (!this.personApplicationService) {
      this.personApplicationService = new PersonApplicationService();
    }

    if (typeof this.personApplicationService?.createPerson !== "function") {
      throw new TypeError("StudentApplicationService requires a personApplicationService.createPerson function.");
    }

    return this.personApplicationService;
  }

  /**
   * @returns {ProfileApplicationService}
   */
  getProfileApplicationService() {
    if (!this.profileApplicationService) {
      this.profileApplicationService = new ProfileApplicationService();
    }

    if (typeof this.profileApplicationService?.createStudentProfile !== "function") {
      throw new TypeError("StudentApplicationService requires a profileApplicationService.createStudentProfile function.");
    }

    return this.profileApplicationService;
  }
}

/**
 * @param {Record<string, unknown>} student
 * @returns {Record<string, unknown>}
 */
function mapStudentToPersonPayload(student = {}) {
  return {
    ativo: true,
    bairro: nullableText(student.bairro ?? student.endereco?.bairro),
    celular: nullableText(student.celular ?? student.whatsapp),
    cep: nullableText(student.cep ?? student.endereco?.cep),
    cidade: nullableText(student.cidade ?? student.endereco?.cidade),
    complemento: nullableText(student.complemento ?? student.endereco?.complemento),
    cpf: nullableText(student.cpf),
    dataNascimento: nullableText(student.dataNascimento),
    email: nullableText(student.email),
    estado: nullableText(student.estado ?? student.endereco?.estado),
    logradouro: nullableText(student.logradouro ?? student.endereco?.logradouro ?? student.endereco?.rua),
    nome: text(student.nome ?? student.nomeCompleto),
    numero: nullableText(student.numero ?? student.endereco?.numero),
    rg: nullableText(student.rg),
    sexo: nullableText(student.sexo),
    telefone: nullableText(student.telefone),
  };
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
 * @param {unknown} person
 * @returns {string|null}
 */
function readPersonId(person) {
  const id = person && typeof person === "object" ? person.id ?? person.personId ?? person.person_id : null;
  return nullableText(id);
}

/**
 * @param {Record<string, unknown>} student
 * @param {string} personId
 * @returns {Record<string, unknown>}
 */
function buildResolvedStudentPerson(student = {}, personId) {
  return {
    ...mapStudentToPersonPayload(student),
    id: personId,
  };
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function normalizeStudent(value) {
  return normalizeObject(value);
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * @param {Record<string, unknown>} student
 * @returns {string[]}
 */
function getMissingStudentPersonFields(student = {}) {
  return ["nome", "dataNascimento", "sexo"].filter((field) => !nullableText(student[field]));
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
 * @returns {string|null}
 */
function nullableText(value) {
  const normalized = text(value);
  return normalized || null;
}

/**
 * @param {string} field
 * @param {string} message
 * @param {string} code
 * @returns {{ field: string, message: string, code: string }}
 */
function warning(field, message, code) {
  return { code, field, message };
}

module.exports = {
  STUDENT_PERSON_STEP,
  STUDENT_PROFILE_STEP,
  StudentApplicationService,
  buildResolvedStudentPerson,
  mapStudentToPersonPayload,
  readPersonId,
  readStudentPersonId,
};
