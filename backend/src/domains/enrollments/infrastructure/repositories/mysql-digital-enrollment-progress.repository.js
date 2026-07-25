const { randomUUID } = require("node:crypto");
const {
  DigitalEnrollmentProgress,
} = require("../../domain/entities/digital-enrollment-progress.entity.js");

const INSERT_SQL = `
  INSERT INTO digital_enrollment_progress (
    id, enrollment_id, responsible_relationship_id, current_step,
    completed_steps_json, revision, status, schema_version,
    started_at, last_saved_at, ready_for_review_at, updated_by_invitation_id
  ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
`;
const SELECT_SQL = "SELECT * FROM digital_enrollment_progress WHERE enrollment_id = ? LIMIT 1";
const UPDATE_SQL = `
  UPDATE digital_enrollment_progress
  SET current_step = ?, completed_steps_json = ?, status = ?,
      schema_version = ?, started_at = ?, last_saved_at = ?,
      ready_for_review_at = ?, updated_by_invitation_id = ?,
      revision = revision + 1, updated_at = CURRENT_TIMESTAMP
  WHERE enrollment_id = ? AND responsible_relationship_id = ? AND revision = ?
  LIMIT 1
`;

class MySqlDigitalEnrollmentProgressRepository {
  constructor({ queryRunner = null } = {}) {
    this.query = queryRunner || require("../../../config/db.js").query;
  }

  async findByEnrollmentId(enrollmentId, queryRunner = this.query) {
    const rows = await queryRunner(SELECT_SQL, [required(enrollmentId)]);
    return map(Array.isArray(rows) ? rows[0] : null);
  }

  async createProgress(input, queryRunner = this.query) {
    const progress = new DigitalEnrollmentProgress(input);
    try {
      await queryRunner(INSERT_SQL, [
        input.id || randomUUID(),
        progress.enrollmentId,
        progress.responsibleRelationshipId,
        progress.currentStep,
        JSON.stringify(progress.completedSteps),
        progress.status,
        progress.schemaVersion,
        progress.startedAt,
        progress.lastSavedAt,
        progress.readyForReviewAt,
        progress.updatedByInvitationId,
      ]);
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        return {
          created: false,
          progress: await this.findByEnrollmentId(progress.enrollmentId, queryRunner),
        };
      }
      throw persistenceError();
    }
    return {
      created: true,
      progress: await this.findByEnrollmentId(progress.enrollmentId, queryRunner),
    };
  }

  async ensureProgressForEnrollment(input, queryRunner = this.query) {
    const current = await this.findByEnrollmentId(input.enrollmentId, queryRunner);
    if (current) {
      if (current.responsibleRelationshipId !== input.responsibleRelationshipId) throw conflict();
      return { created: false, progress: current };
    }
    return this.createProgress(input, queryRunner);
  }

  async updateIfRevisionMatches(input, queryRunner = this.query) {
    const current = await this.findByEnrollmentId(input.enrollmentId, queryRunner);
    if (!current) throw conflict();
    const next = new DigitalEnrollmentProgress({
      ...current,
      ...input.patch,
      revision: current.revision,
    });
    const result = await queryRunner(UPDATE_SQL, [
      next.currentStep,
      JSON.stringify(next.completedSteps),
      next.status,
      next.schemaVersion,
      next.startedAt,
      next.lastSavedAt,
      next.readyForReviewAt,
      next.updatedByInvitationId,
      next.enrollmentId,
      input.responsibleRelationshipId,
      input.expectedRevision,
    ]);
    if (Number(result?.affectedRows) !== 1) throw conflict();
    return this.findByEnrollmentId(next.enrollmentId, queryRunner);
  }
}

function map(row) {
  if (!row) return null;
  return new DigitalEnrollmentProgress({
    completedSteps: JSON.parse(row.completed_steps_json || "[]"),
    currentStep: row.current_step,
    enrollmentId: row.enrollment_id,
    lastSavedAt: row.last_saved_at,
    readyForReviewAt: row.ready_for_review_at,
    responsibleRelationshipId: row.responsible_relationship_id,
    revision: row.revision,
    schemaVersion: row.schema_version,
    startedAt: row.started_at,
    status: row.status,
    updatedByInvitationId: row.updated_by_invitation_id,
  });
}
function required(value) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError("enrollmentId is required.");
  return normalized;
}
function conflict() {
  const error = new Error("Digital enrollment progress conflict.");
  error.code = "DIGITAL_ENROLLMENT_PROGRESS_CONFLICT";
  error.statusCode = 409;
  return error;
}
function persistenceError() {
  const error = new Error("Digital enrollment progress persistence failed.");
  error.code = "DIGITAL_ENROLLMENT_PROGRESS_PERSISTENCE_FAILED";
  return error;
}

module.exports = {
  INSERT_SQL,
  MySqlDigitalEnrollmentProgressRepository,
  SELECT_SQL,
  UPDATE_SQL,
};
