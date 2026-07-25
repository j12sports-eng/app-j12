const { EnrollmentStatus } = require("../domain/enums/enrollment-status.enum.js");

class DigitalEnrollmentFormGateway {
  constructor({
    enrollmentRepository,
    invitationRepository,
    progressRepository,
    relationshipRepository,
    transactionRunner,
  } = {}) {
    this.enrollmentRepository = enrollmentRepository;
    this.invitationRepository = invitationRepository;
    this.progressRepository = progressRepository;
    this.relationshipRepository = relationshipRepository;
    this.transactionRunner = transactionRunner;
  }

  async loadFormAggregate(enrollmentId, queryRunner) {
    const enrollment = await this.enrollmentRepository.findById(enrollmentId, queryRunner);
    if (!enrollment || enrollment.status !== EnrollmentStatus.DRAFT) throw unavailable();
    const relationshipId = enrollment.responsibleRelationshipId;
    if (!relationshipId) throw unavailable();
    const relationship = await this.relationshipRepository.findById(relationshipId, queryRunner);
    if (
      !relationship ||
      relationship.status !== "active" ||
      relationship.personId !== enrollment.responsiblePersonId ||
      relationship.relatedPersonId !== enrollment.studentPersonId
    ) {
      throw unavailable();
    }
    const progress = await this.progressRepository.findByEnrollmentId(enrollmentId, queryRunner);
    if (!progress || progress.responsibleRelationshipId !== relationshipId) throw unavailable();
    return Object.freeze({ enrollment, progress, relationship });
  }

  async ensureProgress(enrollmentId, relationshipId, invitationId) {
    return this.transaction(async (queryRunner) => {
      const enrollment = await this.enrollmentRepository.findById(enrollmentId, queryRunner);
      if (
        !enrollment ||
        enrollment.status !== EnrollmentStatus.DRAFT ||
        enrollment.responsibleRelationshipId !== relationshipId
      ) {
        throw unavailable();
      }
      return this.progressRepository.ensureProgressForEnrollment(
        {
          enrollmentId,
          responsibleRelationshipId: relationshipId,
          updatedByInvitationId: invitationId,
        },
        queryRunner,
      );
    });
  }

  async transaction(callback) {
    if (typeof this.transactionRunner !== "function") throw unavailable();
    return this.transactionRunner(callback);
  }
}

function unavailable() {
  const error = new Error("Digital enrollment ownership is not available.");
  error.code = "DIGITAL_ENROLLMENT_OWNERSHIP_NOT_AVAILABLE";
  error.statusCode = 404;
  return error;
}

module.exports = { DigitalEnrollmentFormGateway, unavailable };
