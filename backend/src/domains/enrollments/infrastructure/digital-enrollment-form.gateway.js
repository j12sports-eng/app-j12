const { EnrollmentStatus } = require("../domain/enums/enrollment-status.enum.js");
const { normalizeEmail, normalizePhone } = require("../../pessoas/person-identity-normalizer.js");
const {
  DIGITAL_ENROLLMENT_STEPS,
} = require("../domain/entities/digital-enrollment-progress.entity.js");
const {
  FOUNDATION_BLOCKER,
  PUBLIC_ERROR_CODE,
} = require("../application/services/digital-enrollment-contract.service.js");

const PERSON_FIELD_COLUMNS = Object.freeze({
  birthCity: "birth_city",
  birthState: "birth_state",
  nationality: "nationality",
  bloodType: "blood_type",
  birthDate: "data_nascimento",
  city: "cidade",
  complement: "complemento",
  district: "bairro",
  email: "email",
  name: "nome",
  number: "numero",
  phone: "telefone",
  state: "estado",
  street: "logradouro",
  zipCode: "cep",
});
const OPERATION_STEP = Object.freeze({
  updateResponsible: "RESPONSIBLE_DATA",
  updateStudent: "STUDENT_DATA",
  updateAddress: "ADDRESS",
  updateAdditionalInformation: "ADDITIONAL_INFORMATION",
});

class DigitalEnrollmentFormGateway {
  constructor({
    enrollmentRepository,
    progressRepository,
    relationshipRepository,
    transactionRunner,
  } = {}) {
    this.enrollmentRepository = enrollmentRepository;
    this.progressRepository = progressRepository;
    this.relationshipRepository = relationshipRepository;
    this.transactionRunner = transactionRunner;
  }

  async loadFormAggregate(enrollmentId, unitId, context) {
    const repositories = resolveRepositories(this, context);
    const enrollment = await repositories.enrollmentRepository.findById(
      enrollmentId,
      context.queryRunner,
    );
    if (!enrollment || enrollment.status !== EnrollmentStatus.DRAFT) throw unavailable();
    const enrollmentUnitId = readUnitId(enrollment);
    if (!unitId || !enrollmentUnitId || enrollmentUnitId !== unitId) throw unavailable();
    if (
      !enrollment.responsiblePersonId ||
      !enrollment.responsibleProfileId ||
      !enrollment.responsibleRelationshipId ||
      !enrollment.studentPersonId ||
      !enrollment.studentProfileId
    )
      throw unavailable();
    const [relationship, responsibleProfile, studentProfile, responsible, student, progress] =
      await Promise.all([
        repositories.relationshipRepository.findById(enrollment.responsibleRelationshipId),
        repositories.personProfileRepository.findById(enrollment.responsibleProfileId),
        repositories.personProfileRepository.findById(enrollment.studentProfileId),
        repositories.personRepository.findById(enrollment.responsiblePersonId),
        repositories.personRepository.findById(enrollment.studentPersonId),
        repositories.progressRepository.findByEnrollmentId(enrollmentId, context.queryRunner),
      ]);
    if (
      !relationship ||
      relationship.status !== "active" ||
      relationship.personId !== enrollment.responsiblePersonId ||
      relationship.relatedPersonId !== enrollment.studentPersonId
    )
      throw unavailable();
    if (
      !responsibleProfile ||
      responsibleProfile.personId !== enrollment.responsiblePersonId ||
      !studentProfile ||
      studentProfile.personId !== enrollment.studentPersonId
    )
      throw unavailable();
    if (
      !responsible ||
      !student ||
      !progress ||
      progress.responsibleRelationshipId !== enrollment.responsibleRelationshipId
    )
      throw unavailable();
    return { enrollment, progress, relationship, responsible, student };
  }

  async executeDigitalEnrollmentOperation({ command = {}, invitation, operation }) {
    const enrollmentId = invitation?.enrollmentId;
    const unitId = readUnitId(invitation);
    if (!enrollmentId || !invitation?.invitationId || !unitId) throw unavailable();
    return this.transaction(async (context) => {
      const aggregate = await this.loadFormAggregate(enrollmentId, unitId, context);
      if (operation === "getForm") return toFormDto(aggregate);
      if (operation === "getReview") return toReviewDto(aggregate);
      if (operation === "advanceStep") return this.advance(aggregate, command, invitation, context);
      if (!Object.prototype.hasOwnProperty.call(OPERATION_STEP, operation)) throw unavailable();
      return this.updateStep(aggregate, operation, command, invitation, context);
    });
  }

  async updateStep(aggregate, operation, command, invitation, context) {
    if (aggregate.progress.revision !== command.revision) throw conflict();
    const personId =
      operation === "updateResponsible"
        ? aggregate.enrollment.responsiblePersonId
        : aggregate.enrollment.studentPersonId;
    await updatePerson(context.queryRunner, personId, command.fields);
    const progress = await context.digitalEnrollmentProgressRepository.updateIfRevisionMatches({
      enrollmentId: aggregate.enrollment.id,
      expectedRevision: command.revision,
      responsibleRelationshipId: aggregate.enrollment.responsibleRelationshipId,
      patch: {
        lastSavedAt: new Date(),
        startedAt: aggregate.progress.startedAt || new Date(),
        status: "IN_PROGRESS",
        updatedByInvitationId: invitation.invitationId,
      },
    });
    const refreshed = await this.loadFormAggregate(
      aggregate.enrollment.id,
      readUnitId(invitation),
      context,
    );
    return {
      ...toFormDto(refreshed),
      progress: toProgressDto(progress),
      savedStep: OPERATION_STEP[operation],
    };
  }

  async advance(aggregate, command, invitation, context) {
    if (aggregate.progress.revision !== command.revision) throw conflict();
    const targetStep = command.fields.targetStep;
    // REVIEW remains unavailable until the canonical digital contract flow is operational.
    if (targetStep === "REVIEW") throw contractUnavailable();
    const currentIndex = DIGITAL_ENROLLMENT_STEPS.indexOf(aggregate.progress.currentStep);
    if (DIGITAL_ENROLLMENT_STEPS[currentIndex + 1] !== targetStep) throw invalidStep();
    const completedSteps = [
      ...new Set([...aggregate.progress.completedSteps, aggregate.progress.currentStep]),
    ];
    const ready = targetStep === "REVIEW";
    const progress = await context.digitalEnrollmentProgressRepository.updateIfRevisionMatches({
      enrollmentId: aggregate.enrollment.id,
      expectedRevision: command.revision,
      responsibleRelationshipId: aggregate.enrollment.responsibleRelationshipId,
      patch: {
        completedSteps,
        currentStep: targetStep,
        lastSavedAt: new Date(),
        readyForReviewAt: ready ? new Date() : null,
        startedAt: aggregate.progress.startedAt || new Date(),
        status: ready ? "READY_FOR_REVIEW" : "IN_PROGRESS",
        updatedByInvitationId: invitation.invitationId,
      },
    });
    return { currentStep: progress.currentStep, progress: toProgressDto(progress) };
  }

  async inspectDigitalEnrollmentAdvance({ command = {}, invitation } = {}) {
    const enrollmentId = invitation?.enrollmentId;
    const unitId = readUnitId(invitation);
    if (!enrollmentId || !invitation?.invitationId || !unitId) throw unavailable();
    return this.transaction(async (context) => {
      const aggregate = await this.loadFormAggregate(enrollmentId, unitId, context);
      if (aggregate.progress.revision !== command.revision) throw conflict();
      const targetStep = command.fields?.targetStep;
      const currentIndex = DIGITAL_ENROLLMENT_STEPS.indexOf(aggregate.progress.currentStep);
      if (DIGITAL_ENROLLMENT_STEPS[currentIndex + 1] !== targetStep) throw invalidStep();
      return Object.freeze({
        currentStep: aggregate.progress.currentStep,
        enrollmentId: aggregate.enrollment.id,
        responsibleRelationshipId: aggregate.enrollment.responsibleRelationshipId,
        revision: aggregate.progress.revision,
        unitId,
      });
    });
  }
  async ensureProgress(enrollmentId, relationshipId, invitationId, unitId) {
    return this.transaction(async (context) => {
      const repositories = resolveRepositories(this, context);
      const enrollment = await repositories.enrollmentRepository.findById(
        enrollmentId,
        context.queryRunner,
      );
      if (
        !enrollment ||
        enrollment.status !== EnrollmentStatus.DRAFT ||
        enrollment.responsibleRelationshipId !== relationshipId ||
        !unitId ||
        readUnitId(enrollment) !== unitId
      )
        throw unavailable();
      return repositories.progressRepository.ensureProgressForEnrollment(
        {
          enrollmentId,
          responsibleRelationshipId: relationshipId,
          updatedByInvitationId: invitationId,
        },
        context.queryRunner,
      );
    });
  }

  async resolveDocumentAccess(invitation) {
    const enrollmentId = invitation?.enrollmentId;
    const unitId = readUnitId(invitation);
    if (!enrollmentId || !invitation?.invitationId || !unitId) throw unavailable();
    return this.transaction(async (context) => {
      const aggregate = await this.loadFormAggregate(enrollmentId, unitId, context);
      return Object.freeze({
        enrollmentId: aggregate.enrollment.id,
        responsibleRelationshipId: aggregate.enrollment.responsibleRelationshipId,
        progressRevision: aggregate.progress.revision,
        unitId,
      });
    });
  }

  async transaction(callback) {
    if (typeof this.transactionRunner !== "function") throw unavailable();
    return this.transactionRunner((value) => callback(normalizeContext(value)));
  }
}

function resolveRepositories(gateway, context) {
  return {
    enrollmentRepository: context.enrollmentRepository || gateway.enrollmentRepository,
    personProfileRepository: context.personProfileRepository,
    personRepository: context.personRepository,
    progressRepository: context.digitalEnrollmentProgressRepository || gateway.progressRepository,
    relationshipRepository: context.personRelationshipRepository || gateway.relationshipRepository,
  };
}
function normalizeContext(value) {
  if (typeof value === "function") return { queryRunner: value };
  return value || {};
}
async function updatePerson(queryRunner, personId, fields) {
  const entries = Object.entries(fields || {});
  if (entries.length === 0) return;
  const assignments = [];
  const params = [];
  for (const [field, value] of entries) {
    if (value === undefined) continue;
    const column = PERSON_FIELD_COLUMNS[field];
    if (!column) throw invalidStep();
    const normalized = normalizePersonField(field, value);
    assignments.push(`${column} = ?`);
    params.push(normalized);
    if (field === "email") {
      assignments.push("email_normalized = ?");
      params.push(normalized ? normalizeEmail(normalized) : null);
    }
    if (field === "phone") {
      assignments.push("telefone_normalized = ?");
      params.push(normalized ? normalizePhone(normalized) : null);
    }
  }
  params.push(personId);
  const result = await queryRunner(
    `UPDATE people SET ${assignments.join(", ")} WHERE id = ?`,
    params,
  );
  if (Number(result?.affectedRows) !== 1) throw unavailable();
}
function normalizePersonField(field, value) {
  const limits = {
    birthCity: 191,
    birthState: 50,
    nationality: 191,
    bloodType: 20,
    birthDate: 10,
    city: 191,
    complement: 191,
    district: 191,
    email: 191,
    name: 191,
    number: 30,
    phone: 50,
    state: 50,
    street: 191,
    zipCode: 20,
  };
  const normalized = String(value ?? "")
    .trim()
    .slice(0, limits[field]);
  if (field === "name" && !normalized) throw invalidStep();
  if (field === "birthDate" && normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized))
    throw invalidStep();
  try {
    if (field === "email" && normalized) normalizeEmail(normalized);
    if (field === "phone" && normalized) normalizePhone(normalized);
  } catch {
    throw invalidStep();
  }
  return normalized || null;
}

function toFormDto({ progress, responsible, student }) {
  return Object.freeze({
    address: Object.freeze({ ...(student.address || {}) }),
    additionalInformation: Object.freeze({}),
    progress: toProgressDto(progress),
    responsible: Object.freeze({
      email: responsible.contact?.email || "",
      name: responsible.name?.fullName || "",
      phone: responsible.contact?.phone || "",
    }),
    student: Object.freeze({
      birthCity: student.birthCity || "",
      birthDate: student.birthDate || "",
      birthState: student.birthState || "",
      bloodType: student.bloodType || "",
      name: student.name?.fullName || "",
      nationality: student.nationality || "",
    }),
  });
}
function toReviewDto(aggregate) {
  if (
    aggregate.progress.currentStep !== "REVIEW" ||
    aggregate.progress.status !== "READY_FOR_REVIEW"
  )
    throw invalidStep();
  return toFormDto(aggregate);
}
function toProgressDto(progress) {
  return Object.freeze({
    completedSteps: [...progress.completedSteps],
    currentStep: progress.currentStep,
    revision: progress.revision,
    status: progress.status,
  });
}
function readUnitId(value) {
  return String(value?.unitId ?? value?.unit_id ?? "").trim() || null;
}

function unavailable() {
  const error = new Error("Digital enrollment ownership is not available.");
  error.code = "DIGITAL_ENROLLMENT_OWNERSHIP_NOT_AVAILABLE";
  error.statusCode = 404;
  return error;
}
function conflict() {
  const error = new Error("Digital enrollment progress conflict.");
  error.code = "DIGITAL_ENROLLMENT_PROGRESS_CONFLICT";
  error.statusCode = 409;
  error.expose = true;
  return error;
}
function contractUnavailable() {
  const error = new Error("Digital enrollment contract is not available.");
  error.code = PUBLIC_ERROR_CODE;
  error.blocker = FOUNDATION_BLOCKER;
  error.statusCode = 503;
  error.expose = false;
  return error;
}
function invalidStep() {
  const error = new Error("Digital enrollment step is invalid.");
  error.code = "DIGITAL_ENROLLMENT_INVALID_STEP";
  error.statusCode = 400;
  error.expose = true;
  return error;
}

module.exports = {
  DigitalEnrollmentFormGateway,
  PERSON_FIELD_COLUMNS,
  conflict,
  invalidStep,
  unavailable,
};
