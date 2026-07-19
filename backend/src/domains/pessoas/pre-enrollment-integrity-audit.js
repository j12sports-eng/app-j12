const {
  PersonIdentityDiagnosticReadRepository,
  PersonIdentityDiagnosticService,
  createReadOnlyQueryRunner,
} = require("./person-identity-diagnostic.js");

const PRE_ENROLLMENT_INTEGRITY_AUDIT_VERSION = "1.0.0";
const DEFAULT_DUPLICATE_GROUP_LIMIT = 100;

const DUPLICATE_PROFILE_GROUPS_SQL = `
  SELECT
    person_id,
    LOWER(TRIM(profile_type)) profile_type,
    COUNT(*) total,
    GROUP_CONCAT(id ORDER BY id SEPARATOR ',') ids
  FROM person_profiles
  GROUP BY person_id, LOWER(TRIM(profile_type))
  HAVING COUNT(*) > 1
  ORDER BY person_id ASC, profile_type ASC
  LIMIT ?
`;

const DUPLICATE_ACTIVE_RELATIONSHIP_GROUPS_SQL = `
  SELECT
    person_id,
    related_person_id,
    LOWER(TRIM(relationship_type)) relationship_type,
    COUNT(*) total,
    GROUP_CONCAT(id ORDER BY id SEPARATOR ',') ids
  FROM person_relationships
  WHERE status = 'active'
  GROUP BY person_id, related_person_id, LOWER(TRIM(relationship_type))
  HAVING COUNT(*) > 1
  ORDER BY person_id ASC, related_person_id ASC, relationship_type ASC
  LIMIT ?
`;

const DUPLICATE_DRAFT_GROUPS_SQL = `
  SELECT
    student_person_id,
    student_profile_id,
    COUNT(*) total,
    GROUP_CONCAT(id ORDER BY id SEPARATOR ',') ids
  FROM enrollments
  WHERE status = 'DRAFT' AND deleted_at IS NULL
  GROUP BY student_person_id, student_profile_id
  HAVING COUNT(*) > 1
  ORDER BY student_person_id ASC, student_profile_id ASC
  LIMIT ?
`;

const INTEGRITY_SCHEMA_SQL = `
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name IN ('people', 'person_profiles', 'person_relationships', 'enrollments')
  ORDER BY table_name ASC, ordinal_position ASC
`;

const INTEGRITY_INDEXES_SQL = `
  SELECT
    table_name,
    index_name,
    non_unique,
    GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') columns
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name IN ('people', 'person_profiles', 'person_relationships', 'enrollments')
  GROUP BY table_name, index_name, non_unique
  ORDER BY table_name ASC, index_name ASC
`;

class PreEnrollmentIntegrityAuditService {
  constructor({
    clock = () => new Date(),
    duplicateGroupLimit = DEFAULT_DUPLICATE_GROUP_LIMIT,
  } = {}) {
    this.clock = clock;
    this.duplicateGroupLimit = boundedLimit(duplicateGroupLimit);
  }

  async audit(queryRunner, options = {}) {
    const query = createReadOnlyQueryRunner(queryRunner);
    const limit = boundedLimit(options.duplicateGroupLimit ?? this.duplicateGroupLimit);
    const identityRepository = new PersonIdentityDiagnosticReadRepository({ queryRunner: query });
    const identity = await new PersonIdentityDiagnosticService({
      clock: this.clock,
      maxIssueGroups: limit,
    }).analyzeRepository(identityRepository, options.identity || {});

    const [profileRows, relationshipRows, draftRows, columnRows, indexRows] = await Promise.all([
      query(DUPLICATE_PROFILE_GROUPS_SQL, [limit]),
      query(DUPLICATE_ACTIVE_RELATIONSHIP_GROUPS_SQL, [limit]),
      query(DUPLICATE_DRAFT_GROUPS_SQL, [limit]),
      query(INTEGRITY_SCHEMA_SQL),
      query(INTEGRITY_INDEXES_SQL),
    ]);

    const profiles = mapProfileGroups(profileRows);
    const relationships = mapRelationshipGroups(relationshipRows);
    const draftEnrollments = mapDraftGroups(draftRows);
    const schema = buildSchemaState(columnRows, indexRows);

    return Object.freeze({
      contractVersion: PRE_ENROLLMENT_INTEGRITY_AUDIT_VERSION,
      duplicateGroups: Object.freeze({ draftEnrollments, profiles, relationships }),
      generatedAt: toIso(this.clock()),
      identity,
      migrationReadiness: Object.freeze({
        enrollmentDraftConstraintHealthy:
          draftEnrollments.length === 0 && schema.enrollmentDraftUniqueIndex,
        normalizedIdentity: Object.freeze({
          canApply: identity.metrics.duplicateCpfGroups === 0,
          currentlyApplied: schema.normalizedIdentityReady,
        }),
        profileUniqueness: Object.freeze({
          canApply: profiles.length === 0,
          currentlyApplied: schema.profileUniqueIndex,
        }),
        relationshipUniqueness: Object.freeze({
          canApply: relationships.length === 0,
          currentlyApplied: schema.relationshipUniqueIndex,
        }),
      }),
      privacy: Object.freeze({ identityValues: "REDACTED", outputContainsRawPii: false }),
      readOnly: true,
      schema,
    });
  }
}

function mapProfileGroups(rows) {
  return freezeRows(rows, (row) => ({
    count: safeCount(row.total),
    ids: splitIds(row.ids),
    personId: text(row.person_id),
    profileType: text(row.profile_type),
  }));
}

function mapRelationshipGroups(rows) {
  return freezeRows(rows, (row) => ({
    count: safeCount(row.total),
    ids: splitIds(row.ids),
    personId: text(row.person_id),
    relatedPersonId: text(row.related_person_id),
    relationshipType: text(row.relationship_type),
  }));
}

function mapDraftGroups(rows) {
  return freezeRows(rows, (row) => ({
    count: safeCount(row.total),
    ids: splitIds(row.ids),
    studentPersonId: text(row.student_person_id),
    studentProfileId: text(row.student_profile_id),
  }));
}

function freezeRows(rows, mapper) {
  return Object.freeze(
    (Array.isArray(rows) ? rows : []).map((row) => {
      const mapped = mapper(row);
      return Object.freeze({ ...mapped, ids: Object.freeze(mapped.ids) });
    }),
  );
}

function buildSchemaState(columnRows, indexRows) {
  const columns = new Set(
    (Array.isArray(columnRows) ? columnRows : []).map(
      (row) => `${text(row.table_name)}.${text(row.column_name)}`,
    ),
  );
  const indexes = new Map(
    (Array.isArray(indexRows) ? indexRows : []).map((row) => [
      `${text(row.table_name)}.${text(row.index_name)}`,
      { columns: text(row.columns), unique: Number(row.non_unique) === 0 },
    ]),
  );
  const normalizedColumns = [
    "celular_normalized",
    "cpf_normalized",
    "email_normalized",
    "telefone_normalized",
  ];

  return Object.freeze({
    enrollmentDraftUniqueIndex: compatibleIndex(
      indexes,
      "enrollments.ux_enrollments_active_draft_student_profile",
      "active_draft_student_person_id,active_draft_student_profile_id",
    ),
    normalizedIdentityReady:
      normalizedColumns.every((column) => columns.has(`people.${column}`)) &&
      normalizedColumns.every((column) =>
        compatibleNonUniqueIndex(indexes, `people.idx_people_${column}`, column),
      ),
    profileUniqueIndex: compatibleIndex(
      indexes,
      "person_profiles.ux_person_profiles_person_type",
      "person_id,profile_type",
    ),
    relationshipUniqueIndex: compatibleIndex(
      indexes,
      "person_relationships.ux_person_relationships_active_structure",
      "active_person_id,active_related_person_id,active_relationship_type",
    ),
  });
}

function compatibleIndex(indexes, name, columns) {
  const index = indexes.get(name);
  return Boolean(index?.unique && index.columns === columns);
}

function compatibleNonUniqueIndex(indexes, name, columns) {
  const index = indexes.get(name);
  return Boolean(index && !index.unique && index.columns === columns);
}

function splitIds(value) {
  return String(value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .sort();
}

function boundedLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    throw new RangeError("duplicateGroupLimit must be an integer between 1 and 1000.");
  }
  return parsed;
}

function safeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function text(value) {
  return String(value ?? "").trim();
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Audit clock must return a valid date.");
  return date.toISOString();
}

module.exports = Object.freeze({
  DEFAULT_DUPLICATE_GROUP_LIMIT,
  DUPLICATE_ACTIVE_RELATIONSHIP_GROUPS_SQL,
  DUPLICATE_DRAFT_GROUPS_SQL,
  DUPLICATE_PROFILE_GROUPS_SQL,
  INTEGRITY_INDEXES_SQL,
  INTEGRITY_SCHEMA_SQL,
  PRE_ENROLLMENT_INTEGRITY_AUDIT_VERSION,
  PreEnrollmentIntegrityAuditService,
  buildSchemaState,
});
