const {
  DigitalEnrollmentAdministrativeReview,
} = require("../../domain/entities/digital-enrollment-administrative-review.entity.js");

const MYSQL_DUPLICATE_ENTRY_CODE = "ER_DUP_ENTRY";
const MYSQL_DUPLICATE_ENTRY_ERRNO = 1062;

const REVIEW_TABLE = "digital_enrollment_administrative_reviews";
const DECISION_TABLE = "digital_enrollment_administrative_review_decisions";
const COMMAND_TABLE = "digital_enrollment_administrative_review_commands";

const REVIEW_PROJECTION = `
  id, enrollment_id, responsible_relationship_id, status, review_round, revision,
  submitted_at, decided_at, decision_code, decision_reason,
  reviewer_auth_identity_id, correction_items_json, created_at, updated_at
`;

const SELECT_REVIEW_BY_ENROLLMENT_SQL = `
  SELECT ${REVIEW_PROJECTION}
  FROM ${REVIEW_TABLE}
  WHERE enrollment_id = ?
  LIMIT 1
`;
const SELECT_REVIEW_FOR_UPDATE_SQL = `
  SELECT ${REVIEW_PROJECTION}
  FROM ${REVIEW_TABLE}
  WHERE enrollment_id = ?
  LIMIT 1
  FOR UPDATE
`;
const SELECT_COMMAND_SQL = `
  SELECT command_id, fingerprint, result_snapshot_json
  FROM ${COMMAND_TABLE}
  WHERE command_id = ?
  LIMIT 1
`;
const INSERT_REVIEW_SQL = `
  INSERT INTO ${REVIEW_TABLE} (
    id, enrollment_id, responsible_relationship_id, status, review_round,
    revision, submitted_at, decided_at, decision_code, decision_reason,
    reviewer_auth_identity_id, correction_items_json, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
const UPDATE_REVIEW_SQL = `
  UPDATE ${REVIEW_TABLE}
  SET status = ?, review_round = ?, revision = ?, submitted_at = ?,
      decided_at = ?, decision_code = ?, decision_reason = ?,
      reviewer_auth_identity_id = ?, correction_items_json = ?, updated_at = ?
  WHERE enrollment_id = ? AND revision = ?
  LIMIT 1
`;
const INSERT_DECISION_SQL = `
  INSERT INTO ${DECISION_TABLE} (
    id, review_id, enrollment_id, command_id, review_round, status,
    decision_code, decision_reason, reviewer_auth_identity_id,
    correction_items_json, decided_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
const INSERT_COMMAND_SQL = `
  INSERT INTO ${COMMAND_TABLE} (
    command_id, operation, enrollment_id, fingerprint, review_id,
    result_revision, result_status, result_snapshot_json, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
const SELECT_DECISIONS_SQL = `
  SELECT id, review_id, enrollment_id, command_id, review_round, status,
         decision_code, decision_reason, reviewer_auth_identity_id,
         correction_items_json, decided_at, created_at
  FROM ${DECISION_TABLE}
  WHERE review_id = ?
  ORDER BY created_at ASC, id ASC
`;

class MySqlDigitalEnrollmentAdministrativeReviewRepository {
  constructor({ idGenerator = null, queryRunner = null, transactionRunner = null } = {}) {
    this.idGenerator = idGenerator || require("node:crypto").randomUUID;
    this.query = queryRunner || getDefaultQueryRunner();
    this.transactionRunner = transactionRunner || getDefaultTransactionRunner();
  }

  async findByEnrollmentId(enrollmentId, queryRunner = this.query) {
    const rows = await queryRunner(SELECT_REVIEW_BY_ENROLLMENT_SQL, [
      requiredText(enrollmentId, "enrollmentId", 64),
    ]);
    return mapReviewRow(readFirstRow(rows));
  }

  async findCommandResult(commandId, queryRunner = this.query) {
    const rows = await queryRunner(SELECT_COMMAND_SQL, [
      requiredText(commandId, "commandId", 64),
    ]);
    return mapCommandRow(readFirstRow(rows));
  }

  async createPendingReview({ commandId, fingerprint, review }) {
    const normalizedCommandId = requiredText(commandId, "commandId", 64);
    const normalizedFingerprint = requiredFingerprint(fingerprint);

    try {
      return await this.transactionRunner(async (queryRunner) => {
        const previous = await this.findCommandResult(normalizedCommandId, queryRunner);
        if (previous) return resolveRetry(previous, normalizedFingerprint);

        const current = await this.findByEnrollmentId(review.enrollmentId, queryRunner);
        if (current) throw conflict();

        await queryRunner(INSERT_REVIEW_SQL, reviewParameters(review));
        await insertCommand(queryRunner, {
          commandId: normalizedCommandId,
          fingerprint: normalizedFingerprint,
          operation: "START_REVIEW",
          review,
        });
        return review;
      });
    } catch (error) {
      return this.resolveDuplicate(error, normalizedCommandId, normalizedFingerprint);
    }
  }

  async updateIfRevisionMatches({
    commandId,
    decision = null,
    expectedRevision,
    fingerprint,
    review,
  }) {
    const normalizedCommandId = requiredText(commandId, "commandId", 64);
    const normalizedFingerprint = requiredFingerprint(fingerprint);

    try {
      return await this.transactionRunner(async (queryRunner) => {
        const previous = await this.findCommandResult(normalizedCommandId, queryRunner);
        if (previous) return resolveRetry(previous, normalizedFingerprint);

        const rows = await queryRunner(SELECT_REVIEW_FOR_UPDATE_SQL, [review.enrollmentId]);
        const current = mapReviewRow(readFirstRow(rows));
        if (!current || current.revision !== expectedRevision) throw conflict();

        const updateResult = await queryRunner(UPDATE_REVIEW_SQL, updateParameters(review, expectedRevision));
        if (readAffectedRows(updateResult) !== 1) throw conflict();

        if (decision) {
          await queryRunner(
            INSERT_DECISION_SQL,
            decisionParameters({
              decision,
              enrollmentId: review.enrollmentId,
              id: this.idGenerator(),
              review,
            }),
          );
        }

        await insertCommand(queryRunner, {
          commandId: normalizedCommandId,
          fingerprint: normalizedFingerprint,
          operation: decision?.status || "RESUBMIT_REVIEW",
          review,
        });
        return review;
      });
    } catch (error) {
      return this.resolveDuplicate(error, normalizedCommandId, normalizedFingerprint);
    }
  }

  async appendDecision() {
    throw new Error("Decisions must be appended atomically through updateIfRevisionMatches.");
  }

  async listDecisionsByReviewId(reviewId, queryRunner = this.query) {
    const rows = await queryRunner(SELECT_DECISIONS_SQL, [
      requiredText(reviewId, "reviewId", 64),
    ]);
    return readRows(rows).map(mapDecisionRow);
  }

  async resolveDuplicate(error, commandId, fingerprint) {
    if (!isDuplicateEntry(error)) throw error;
    const previous = await this.findCommandResult(commandId);
    if (previous) return resolveRetry(previous, fingerprint);
    throw conflict();
  }
}

async function insertCommand(queryRunner, { commandId, fingerprint, operation, review }) {
  await queryRunner(INSERT_COMMAND_SQL, [
    commandId,
    operation,
    review.enrollmentId,
    fingerprint,
    review.id,
    review.revision,
    review.status,
    JSON.stringify(reviewSnapshot(review)),
    toMySqlDate(review.updatedAt),
  ]);
}

function reviewParameters(review) {
  return [
    review.id,
    review.enrollmentId,
    review.responsibleRelationshipId,
    review.status,
    review.reviewRound,
    review.revision,
    toMySqlDate(review.submittedAt),
    toMySqlDate(review.decidedAt),
    review.decisionCode,
    review.decisionReason,
    review.reviewerAuthIdentityId,
    JSON.stringify(review.correctionItems),
    toMySqlDate(review.createdAt),
    toMySqlDate(review.updatedAt),
  ];
}

function updateParameters(review, expectedRevision) {
  return [
    review.status,
    review.reviewRound,
    review.revision,
    toMySqlDate(review.submittedAt),
    toMySqlDate(review.decidedAt),
    review.decisionCode,
    review.decisionReason,
    review.reviewerAuthIdentityId,
    JSON.stringify(review.correctionItems),
    toMySqlDate(review.updatedAt),
    review.enrollmentId,
    expectedRevision,
  ];
}

function decisionParameters({ decision, enrollmentId, id, review }) {
  return [
    id,
    decision.reviewId,
    enrollmentId,
    decision.commandId,
    decision.reviewRound,
    decision.status,
    decision.decisionCode,
    decision.decisionReason,
    decision.reviewerAuthIdentityId,
    JSON.stringify(review.correctionItems),
    toMySqlDate(decision.decidedAt),
    toMySqlDate(decision.decidedAt),
  ];
}

function mapReviewRow(row) {
  if (!row) return null;
  return new DigitalEnrollmentAdministrativeReview({
    correctionItems: parseArray(row.correction_items_json, "correction_items_json"),
    createdAt: normalizeDate(row.created_at, "created_at"),
    decidedAt: normalizeNullableDate(row.decided_at, "decided_at"),
    decisionCode: row.decision_code,
    decisionReason: row.decision_reason,
    enrollmentId: row.enrollment_id,
    id: row.id,
    responsibleRelationshipId: row.responsible_relationship_id,
    reviewerAuthIdentityId: row.reviewer_auth_identity_id,
    reviewRound: Number(row.review_round),
    revision: Number(row.revision),
    status: row.status,
    submittedAt: normalizeDate(row.submitted_at, "submitted_at"),
    updatedAt: normalizeDate(row.updated_at, "updated_at"),
  });
}

function mapCommandRow(row) {
  if (!row) return null;
  const snapshot = parseObject(row.result_snapshot_json, "result_snapshot_json");
  return Object.freeze({
    fingerprint: requiredFingerprint(row.fingerprint),
    review: new DigitalEnrollmentAdministrativeReview(snapshot),
  });
}

function mapDecisionRow(row) {
  return Object.freeze({
    commandId: row.command_id,
    correctionItems: Object.freeze(parseArray(row.correction_items_json, "correction_items_json")),
    decidedAt: normalizeDate(row.decided_at, "decided_at"),
    decisionCode: row.decision_code,
    decisionReason: row.decision_reason,
    enrollmentId: row.enrollment_id,
    id: row.id,
    reviewId: row.review_id,
    reviewerAuthIdentityId: row.reviewer_auth_identity_id,
    reviewRound: Number(row.review_round),
    status: row.status,
  });
}

function reviewSnapshot(review) {
  return {
    correctionItems: [...review.correctionItems],
    createdAt: review.createdAt,
    decidedAt: review.decidedAt,
    decisionCode: review.decisionCode,
    decisionReason: review.decisionReason,
    enrollmentId: review.enrollmentId,
    id: review.id,
    responsibleRelationshipId: review.responsibleRelationshipId,
    reviewerAuthIdentityId: review.reviewerAuthIdentityId,
    reviewRound: review.reviewRound,
    revision: review.revision,
    status: review.status,
    submittedAt: review.submittedAt,
    updatedAt: review.updatedAt,
  };
}

function parseArray(value, field) {
  const parsed = parseJson(value, field);
  if (!Array.isArray(parsed)) throw persistenceError(`Invalid ${field}.`);
  return parsed;
}

function parseObject(value, field) {
  const parsed = parseJson(value, field);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw persistenceError(`Invalid ${field}.`);
  }
  return parsed;
}

function parseJson(value, field) {
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    throw persistenceError(`Invalid ${field}.`);
  }
}

function normalizeDate(value, field) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw persistenceError(`Invalid ${field}.`);
  return date.toISOString();
}

function normalizeNullableDate(value, field) {
  return value == null ? null : normalizeDate(value, field);
}

function toMySqlDate(value) {
  if (value == null) return null;
  return normalizeDate(value, "date").replace("T", " ").replace("Z", "");
}

function readRows(result) {
  if (!Array.isArray(result)) return [];
  return Array.isArray(result[0]) ? result[0] : result;
}

function readFirstRow(result) {
  const row = readRows(result)[0];
  return row && typeof row === "object" && !Array.isArray(row) ? row : null;
}

function readAffectedRows(result) {
  const values = Array.isArray(result) ? result : [result];
  const header = values.find(
    (value) => value && typeof value === "object" && "affectedRows" in value,
  );
  return Number(header?.affectedRows ?? 0);
}

function resolveRetry(previous, fingerprint) {
  if (previous.fingerprint !== fingerprint) throw idempotencyConflict();
  return previous.review;
}

function isDuplicateEntry(error) {
  return (
    error?.code === MYSQL_DUPLICATE_ENTRY_CODE ||
    Number(error?.errno ?? error?.code) === MYSQL_DUPLICATE_ENTRY_ERRNO
  );
}

function requiredText(value, field, max) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > max) {
    throw new TypeError(`MySqlDigitalEnrollmentAdministrativeReviewRepository requires ${field}.`);
  }
  return normalized;
}

function requiredFingerprint(value) {
  const fingerprint = String(value ?? "").trim();
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw new TypeError("A SHA-256 command fingerprint is required.");
  }
  return fingerprint;
}

function conflict() {
  const error = new Error("Digital enrollment administrative review conflict.");
  error.code = "DIGITAL_ENROLLMENT_REVIEW_CONFLICT";
  error.statusCode = 409;
  return error;
}

function idempotencyConflict() {
  const error = new Error("Digital enrollment review command conflicts with a previous command.");
  error.code = "DIGITAL_ENROLLMENT_REVIEW_IDEMPOTENCY_CONFLICT";
  error.statusCode = 409;
  return error;
}

function persistenceError(message = "Digital enrollment review persistence failed.") {
  const error = new Error(message);
  error.code = "DIGITAL_ENROLLMENT_REVIEW_PERSISTENCE_FAILED";
  error.statusCode = 503;
  error.expose = false;
  return error;
}

function getDefaultQueryRunner() {
  return require("../../../../config/db.js").query;
}

function getDefaultTransactionRunner() {
  const {
    createMySqlDigitalEnrollmentAdministrativeReviewTransactionRunner,
  } = require(
    "./mysql-digital-enrollment-administrative-review.transaction-runner.js"
  );

  return createMySqlDigitalEnrollmentAdministrativeReviewTransactionRunner();
}

module.exports = {
  COMMAND_TABLE,
  DECISION_TABLE,
  INSERT_COMMAND_SQL,
  INSERT_DECISION_SQL,
  INSERT_REVIEW_SQL,
  MySqlDigitalEnrollmentAdministrativeReviewRepository,
  REVIEW_TABLE,
  SELECT_COMMAND_SQL,
  SELECT_DECISIONS_SQL,
  SELECT_REVIEW_BY_ENROLLMENT_SQL,
  SELECT_REVIEW_FOR_UPDATE_SQL,
  UPDATE_REVIEW_SQL,
  conflict,
  idempotencyConflict,
  isDuplicateEntry,
  mapCommandRow,
  mapDecisionRow,
  mapReviewRow,
  persistenceError,
  readAffectedRows,
};
