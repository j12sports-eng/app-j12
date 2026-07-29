const { AppError } = require("../../../../errors/app-error.js");
const {
  EnrollmentAuditAction,
} = require("../../../enrollments/application/contracts/enrollment-audit.contract.js");
const {
  EnrollmentFacade,
} = require("../../../enrollments/application/facades/enrollment.facade.js");
const {
  MySqlEnrollmentRepository,
} = require("../../../enrollments/infrastructure/repositories/mysql-enrollment.repository.js");
const { PersonApplicationService } = require("./person-application.service.js");
const { ProfileApplicationService } = require("./profile-application.service.js");
const { RelationshipApplicationService } = require("./relationship-application.service.js");
const { StudentApplicationService } = require("./student-application.service.js");

const PRE_ENROLLMENT_ERROR_CODES = Object.freeze({
  ACCESS_DENIED: "PRE_ENROLLMENT_ACCESS_DENIED",
  CONFIGURATION_INVALID: "PRE_ENROLLMENT_CONFIGURATION_INVALID",
  INPUT_INVALID: "PRE_ENROLLMENT_INPUT_INVALID",
  START_FAILED: "PRE_ENROLLMENT_START_FAILED",
});

const TOP_LEVEL_FIELDS = new Set(["enrollment", "responsible", "student"]);
const ENROLLMENT_FIELDS = new Set(["startDate"]);
const SHARED_PERSON_FIELDS = [
  "bairro",
  "celular",
  "cep",
  "cidade",
  "complemento",
  "cpf",
  "dataNascimento",
  "email",
  "endereco",
  "estado",
  "logradouro",
  "nome",
  "nomeCompleto",
  "numero",
  "personId",
  "person_id",
  "rg",
  "sexo",
  "telefone",
  "whatsapp",
];
const RESPONSIBLE_FIELDS = new Set([...SHARED_PERSON_FIELDS, "relacionamento", "relationship"]);
const STUDENT_FIELDS = new Set(SHARED_PERSON_FIELDS);
const RELATIONSHIP_FIELDS = new Set([
  "emergencia",
  "financeiro",
  "podeBuscar",
  "recebeComunicados",
  "responsavelLegal",
  "tipo",
]);

/**
 * Starts the canonical pre-enrollment journey through Pessoa/Profile/
 * Relationship resolution and an Enrollment in DRAFT state.
 *
 * This service deliberately creates no public token, CRM conversion, charge,
 * contract, class link or ACTIVE Enrollment.
 */
class PreEnrollmentApplicationService {
  constructor({
    authorizeUnit = null,
    enrollmentBoundary = null,
    enrollmentRepository = null,
    logger = console,
    personApplicationService = null,
    profileApplicationService = null,
    relationshipApplicationService = null,
    studentApplicationService = null,
  } = {}) {
    this.authorizeUnit = authorizeUnit;
    this.enrollmentBoundary = enrollmentBoundary;
    this.enrollmentRepository = enrollmentRepository;
    this.logger = logger;
    this.personApplicationService = personApplicationService;
    this.profileApplicationService = profileApplicationService;
    this.relationshipApplicationService = relationshipApplicationService;
    this.studentApplicationService = studentApplicationService;
  }

  async startPreEnrollment(input = {}, context = {}) {
    const unitId = text(context.unitId);
    this.authorize(context, unitId);
    const command = validateAndNormalizeInput(input);
    const identityContext = {
      ...context,
      requireExistingPersonId: true,
      requiresStrongIdentity: true,
    };

    try {
      const responsiblePerson = await this.getPersonApplicationService().resolveOrCreatePerson(
        mapPersonPayload(command.responsible),
        identityContext,
      );
      const responsibleProfile =
        await this.getProfileApplicationService().resolveOrCreateResponsibleProfile({
          personId: responsiblePerson.personId,
        });
      const student = await this.getStudentApplicationService().resolveOrCreateStudent(
        command.student,
        identityContext,
      );
      const relationship =
        await this.getRelationshipApplicationService().resolveOrCreateResponsibleStudentRelationship(
          {
            relationship:
              command.responsible.relationship ?? command.responsible.relacionamento ?? {},
            responsiblePersonId: responsiblePerson.personId,
            studentPersonId: student.personId,
          },
        );
      const enrollment =
        await this.getEnrollmentBoundary().resolveOrCreateDraftEnrollmentForResolvedStudent(
          {
            personId: student.personId,
            personProfileId: student.personProfileId,
            responsiblePersonId: responsiblePerson.personId,
            responsibleProfileId: responsibleProfile.personProfileId,
            responsibleRelationshipId: relationship.relationshipId,
            startDate: command.enrollment.startDate,
          },
          context,
        );

      assertDraftResolution(enrollment);
      const status = enrollment.reused
        ? EnrollmentAuditAction.DRAFT_REUSED
        : EnrollmentAuditAction.DRAFT_CREATED;
      const result = buildResult({
        enrollment,
        relationship,
        responsiblePerson,
        responsibleProfile,
        status,
        student,
      });

      this.prepareAudit(result, context, unitId);
      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;

      throw new AppError("Pre-enrollment could not be started.", {
        code: PRE_ENROLLMENT_ERROR_CODES.START_FAILED,
        expose: false,
        statusCode: 500,
      });
    }
  }

  authorize(context, unitId) {
    if (typeof this.authorizeUnit !== "function") {
      throw new AppError("Pre-enrollment authorization is not configured.", {
        code: PRE_ENROLLMENT_ERROR_CODES.CONFIGURATION_INVALID,
        expose: false,
        statusCode: 500,
      });
    }

    let allowed = false;
    try {
      allowed = Boolean(context?.userId && unitId && this.authorizeUnit(context, unitId));
    } catch {
      allowed = false;
    }

    if (!allowed) {
      throw new AppError("Pre-enrollment access denied.", {
        code: PRE_ENROLLMENT_ERROR_CODES.ACCESS_DENIED,
        expose: true,
        statusCode: 403,
      });
    }
  }

  prepareAudit(result, context, unitId) {
    const boundary = this.getEnrollmentBoundary();
    if (typeof boundary.recordEnrollmentAuditEvent !== "function") return;

    try {
      const event = boundary.recordEnrollmentAuditEvent({
        action: result.status,
        actor: context.userId,
        correlationId: context.correlationId ?? context.requestId,
        enrollmentId: result.enrollmentId,
        metadata: { unitId },
        studentPersonId: result.studentPersonId,
        studentProfileId: result.studentProfileId,
      });
      this.log("info", "pre_enrollment.audit_prepared", event.logPayload);
    } catch {
      // Audit is preparation-only and must not corrupt a completed DRAFT flow.
      this.log("warn", "pre_enrollment.audit_preparation_failed", {
        correlationId: nullableText(context.correlationId ?? context.requestId, 100),
        enrollmentId: result.enrollmentId,
      });
    }
  }

  getPersonApplicationService() {
    if (!this.personApplicationService) {
      this.personApplicationService = new PersonApplicationService();
    }
    if (typeof this.personApplicationService.resolveOrCreatePerson !== "function") {
      throw new TypeError(
        "PreEnrollmentApplicationService requires personApplicationService.resolveOrCreatePerson.",
      );
    }
    return this.personApplicationService;
  }

  getProfileApplicationService() {
    if (!this.profileApplicationService) {
      this.profileApplicationService = new ProfileApplicationService();
    }
    if (typeof this.profileApplicationService.resolveOrCreateResponsibleProfile !== "function") {
      throw new TypeError(
        "PreEnrollmentApplicationService requires profileApplicationService.resolveOrCreateResponsibleProfile.",
      );
    }
    return this.profileApplicationService;
  }

  getStudentApplicationService() {
    if (!this.studentApplicationService) {
      this.studentApplicationService = new StudentApplicationService({
        personApplicationService: this.getPersonApplicationService(),
        profileApplicationService: this.getProfileApplicationService(),
      });
    }
    if (typeof this.studentApplicationService.resolveOrCreateStudent !== "function") {
      throw new TypeError(
        "PreEnrollmentApplicationService requires studentApplicationService.resolveOrCreateStudent.",
      );
    }
    return this.studentApplicationService;
  }

  getRelationshipApplicationService() {
    if (!this.relationshipApplicationService) {
      this.relationshipApplicationService = new RelationshipApplicationService();
    }
    if (
      typeof this.relationshipApplicationService.resolveOrCreateResponsibleStudentRelationship !==
      "function"
    ) {
      throw new TypeError(
        "PreEnrollmentApplicationService requires relationshipApplicationService.resolveOrCreateResponsibleStudentRelationship.",
      );
    }
    return this.relationshipApplicationService;
  }

  getEnrollmentBoundary() {
    if (!this.enrollmentBoundary) {
      this.enrollmentBoundary = new EnrollmentFacade({
        enrollmentRepository:
          this.enrollmentRepository || new MySqlEnrollmentRepository({ logger: this.logger }),
      });
    }
    if (
      typeof this.enrollmentBoundary.resolveOrCreateDraftEnrollmentForResolvedStudent !== "function"
    ) {
      throw new TypeError(
        "PreEnrollmentApplicationService requires the resolved-student Enrollment boundary.",
      );
    }
    return this.enrollmentBoundary;
  }

  log(level, message, context = {}) {
    const writer = this.logger && typeof this.logger === "object" ? this.logger[level] : null;
    if (typeof writer === "function") writer.call(this.logger, message, context);
  }
}

function validateAndNormalizeInput(input) {
  const source = object(input);
  assertAllowedFields(source, TOP_LEVEL_FIELDS, "");
  const responsible = object(source.responsible);
  const student = object(source.student);
  const enrollment = object(source.enrollment);
  assertAllowedFields(responsible, RESPONSIBLE_FIELDS, "responsible.");
  assertAllowedFields(student, STUDENT_FIELDS, "student.");
  assertAllowedFields(enrollment, ENROLLMENT_FIELDS, "enrollment.");

  const relationship = object(responsible.relationship ?? responsible.relacionamento);
  assertAllowedFields(relationship, RELATIONSHIP_FIELDS, "responsible.relationship.");

  const missingFields = [];
  requireIdentity(responsible, "responsible", missingFields);
  requireIdentity(student, "student", missingFields);

  if (!readPersonId(student)) {
    if (!nullableText(student.dataNascimento)) missingFields.push("student.dataNascimento");
    if (!nullableText(student.sexo)) missingFields.push("student.sexo");
  }

  const startDate = normalizeDate(enrollment.startDate);
  if (!startDate) missingFields.push("enrollment.startDate");

  if (missingFields.length) {
    throw new AppError("Pre-enrollment input is invalid.", {
      code: PRE_ENROLLMENT_ERROR_CODES.INPUT_INVALID,
      details: Object.freeze({ fields: [...new Set(missingFields)] }),
      expose: true,
      statusCode: 422,
    });
  }

  return Object.freeze({
    enrollment: Object.freeze({ startDate }),
    responsible: Object.freeze({ ...responsible, relationship }),
    student: Object.freeze({ ...student }),
  });
}

function requireIdentity(person, prefix, missingFields) {
  if (readPersonId(person)) return;
  if (!nullableText(person.nome ?? person.nomeCompleto)) missingFields.push(`${prefix}.nome`);
  if (!nullableText(person.cpf)) missingFields.push(`${prefix}.cpf`);
}

function mapPersonPayload(person = {}) {
  const address = object(person.endereco);
  return {
    ativo: true,
    bairro: nullableText(person.bairro ?? address.bairro),
    celular: nullableText(person.celular ?? person.whatsapp),
    cep: nullableText(person.cep ?? address.cep),
    cidade: nullableText(person.cidade ?? address.cidade),
    complemento: nullableText(person.complemento ?? address.complemento),
    cpf: nullableText(person.cpf),
    dataNascimento: nullableText(person.dataNascimento),
    email: nullableText(person.email),
    estado: nullableText(person.estado ?? address.estado),
    logradouro: nullableText(person.logradouro ?? address.logradouro ?? address.rua),
    nome: text(person.nome ?? person.nomeCompleto),
    numero: nullableText(person.numero ?? address.numero),
    personId: readPersonId(person),
    rg: nullableText(person.rg),
    sexo: nullableText(person.sexo),
    telefone: nullableText(person.telefone),
  };
}

function buildResult({
  enrollment,
  relationship,
  responsiblePerson,
  responsibleProfile,
  status,
  student,
}) {
  return Object.freeze({
    enrollmentId: text(enrollment.enrollmentId),
    enrollmentStatus: "DRAFT",
    relationshipId: text(relationship.relationshipId),
    responsiblePersonId: text(responsiblePerson.personId),
    responsibleProfileId: text(responsibleProfile.personProfileId),
    reused: Object.freeze({
      enrollment: Boolean(enrollment.reused),
      relationship: Boolean(relationship.reused),
      responsiblePerson: Boolean(responsiblePerson.reused),
      responsibleProfile: Boolean(responsibleProfile.reused),
      studentPerson: Boolean(student.reused?.person),
      studentProfile: Boolean(student.reused?.profile),
    }),
    status,
    studentPersonId: text(student.personId),
    studentProfileId: text(student.personProfileId),
  });
}

function assertDraftResolution(value) {
  if (
    !value ||
    !nullableText(value.enrollmentId) ||
    value.enrollmentStatus !== "DRAFT" ||
    !["CREATED", "FOUND"].includes(value.resolution)
  ) {
    throw new AppError("Pre-enrollment DRAFT resolution failed.", {
      code: PRE_ENROLLMENT_ERROR_CODES.START_FAILED,
      expose: false,
      statusCode: 500,
    });
  }
}

function assertAllowedFields(source, allowed, prefix) {
  const fields = Object.keys(source)
    .filter((field) => !allowed.has(field))
    .map((field) => `${prefix}${field}`);
  if (fields.length) {
    throw new AppError("Pre-enrollment input is invalid.", {
      code: PRE_ENROLLMENT_ERROR_CODES.INPUT_INVALID,
      details: Object.freeze({ fields }),
      expose: true,
      statusCode: 422,
    });
  }
}

function normalizeDate(value) {
  const normalized = nullableText(value, 10);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized
    ? null
    : normalized;
}

function readPersonId(person) {
  return person && typeof person === "object"
    ? nullableText(person.personId ?? person.person_id, 64)
    : null;
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, max = 65535) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function nullableText(value, max = 65535) {
  const normalized = text(value, max);
  return normalized || null;
}

module.exports = {
  PRE_ENROLLMENT_ERROR_CODES,
  PreEnrollmentApplicationService,
  assertDraftResolution,
  validateAndNormalizeInput,
};
