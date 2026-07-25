const {
  DigitalEnrollmentProgress,
} = require("../../domain/entities/digital-enrollment-progress.entity.js");

class MemoryDigitalEnrollmentProgressRepository {
  constructor() {
    this.rows = new Map();
  }

  async findByEnrollmentId(enrollmentId) {
    return this.rows.get(enrollmentId) || null;
  }

  async ensureProgressForEnrollment(input) {
    const current = await this.findByEnrollmentId(input.enrollmentId);
    if (current) {
      if (current.responsibleRelationshipId !== input.responsibleRelationshipId) {
        throw conflict();
      }
      return { created: false, progress: current };
    }
    const progress = new DigitalEnrollmentProgress(input);
    this.rows.set(progress.enrollmentId, progress);
    return { created: true, progress };
  }

  async updateIfRevisionMatches(input) {
    const current = await this.findByEnrollmentId(input.enrollmentId);
    if (
      !current ||
      current.revision !== input.expectedRevision ||
      current.responsibleRelationshipId !== input.responsibleRelationshipId
    ) {
      throw conflict();
    }
    const progress = new DigitalEnrollmentProgress({
      ...current,
      ...input.patch,
      enrollmentId: current.enrollmentId,
      responsibleRelationshipId: current.responsibleRelationshipId,
      revision: current.revision + 1,
    });
    if (this.rows.get(input.enrollmentId)?.revision !== input.expectedRevision) {
      throw conflict();
    }
    this.rows.set(progress.enrollmentId, progress);
    return progress;
  }
}

function conflict() {
  const error = new Error("Digital enrollment progress conflict.");
  error.code = "DIGITAL_ENROLLMENT_PROGRESS_CONFLICT";
  error.statusCode = 409;
  return error;
}

module.exports = {
  MemoryDigitalEnrollmentProgressRepository,
  conflict,
};
