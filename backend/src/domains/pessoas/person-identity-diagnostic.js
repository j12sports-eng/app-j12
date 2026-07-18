const {
  PERSON_IDENTITY_ERROR_CODES,
  PERSON_IDENTITY_LIMITS,
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
} = require("./person-identity-normalizer.js");

const IDENTITY_DIAGNOSTIC_CONTRACT_VERSION = "1.0.0";
const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 2000;
const DEFAULT_MAX_RECORDS = 10000;
const MAX_RECORDS = 100000;
const DEFAULT_MAX_ISSUE_GROUPS = 100;

const IDENTITY_ISSUE_TYPES = Object.freeze({
  DUPLICATE_STRONG_IDENTIFIER: "DUPLICATE_STRONG_IDENTIFIER",
  FORMAT_VARIATION: "FORMAT_VARIATION",
  INCOMPLETE_IDENTITY: "INCOMPLETE_IDENTITY",
  INVALID_IDENTIFIER: "INVALID_IDENTIFIER",
  LEGACY_INCOMPATIBILITY: "LEGACY_INCOMPATIBILITY",
  SHARED_CONTACT: "SHARED_CONTACT",
});

const IDENTITY_SEVERITIES = Object.freeze({
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
});

const PEOPLE_IDENTITY_PAGE_SQL = `
  SELECT id, cpf, email, telefone, celular, ativo
  FROM people
  WHERE id > ?
  ORDER BY id ASC
  LIMIT ?
`;

const DUPLICATE_PROFILES_SQL = `
  SELECT
    person_id,
    LOWER(TRIM(profile_type)) AS profile_type,
    COUNT(*) AS profile_count,
    SUM(CASE WHEN LOWER(TRIM(status)) IN ('ativo', 'active') THEN 1 ELSE 0 END) AS active_count,
    COUNT(DISTINCT LOWER(TRIM(status))) AS status_count
  FROM person_profiles
  GROUP BY person_id, LOWER(TRIM(profile_type))
  HAVING COUNT(*) > 1
  ORDER BY person_id ASC, profile_type ASC
  LIMIT ?
`;

class PersonIdentityDiagnosticReadRepository {
  constructor({ queryRunner }) {
    if (typeof queryRunner !== "function") {
      throw new TypeError("PersonIdentityDiagnosticReadRepository requires queryRunner.");
    }
    this.query = createReadOnlyQueryRunner(queryRunner);
  }

  async *iteratePeople({ batchSize = DEFAULT_BATCH_SIZE, maxRecords = DEFAULT_MAX_RECORDS } = {}) {
    const pageSize = boundedInteger(batchSize, "batchSize", 1, MAX_BATCH_SIZE);
    const recordLimit = boundedInteger(maxRecords, "maxRecords", 1, MAX_RECORDS);
    let cursor = "";
    let processed = 0;

    while (processed < recordLimit) {
      const limit = Math.min(pageSize, recordLimit - processed);
      const rows = await this.query(PEOPLE_IDENTITY_PAGE_SQL, [cursor, limit]);
      const page = Array.isArray(rows) ? rows : [];
      if (page.length === 0) return;

      const safePage = page.slice(0, limit);
      yield safePage;
      processed += safePage.length;
      cursor = String(safePage.at(-1)?.id ?? "");
      if (!cursor || safePage.length < limit) return;
    }
  }

  async findDuplicateProfiles({ limit = DEFAULT_MAX_ISSUE_GROUPS } = {}) {
    const safeLimit = boundedInteger(limit, "limit", 1, 1000);
    const rows = await this.query(DUPLICATE_PROFILES_SQL, [safeLimit]);
    return (Array.isArray(rows) ? rows : []).map((row) =>
      Object.freeze({
        activeCount: safeCount(row.active_count),
        personId: String(row.person_id ?? ""),
        profileCount: safeCount(row.profile_count),
        profileType: String(row.profile_type ?? ""),
        statusCount: safeCount(row.status_count),
      }),
    );
  }
}

class PersonIdentityDiagnosticService {
  constructor({ clock = () => new Date(), maxIssueGroups = DEFAULT_MAX_ISSUE_GROUPS } = {}) {
    this.clock = clock;
    this.maxIssueGroups = boundedInteger(maxIssueGroups, "maxIssueGroups", 1, 1000);
  }

  async analyzeRepository(repository, options = {}) {
    if (!repository || typeof repository.iteratePeople !== "function") {
      throw new TypeError("PersonIdentityDiagnosticService requires a read-only repository.");
    }

    const batchSize = boundedInteger(
      options.batchSize ?? DEFAULT_BATCH_SIZE,
      "batchSize",
      1,
      MAX_BATCH_SIZE,
    );
    const maxRecords = boundedInteger(
      options.maxRecords ?? DEFAULT_MAX_RECORDS,
      "maxRecords",
      1,
      MAX_RECORDS,
    );
    const state = createDiagnosticState(this.maxIssueGroups);
    const startedAt = this.clock();

    for await (const batch of repository.iteratePeople({ batchSize, maxRecords })) {
      if (!Array.isArray(batch)) throw new TypeError("Identity diagnostic batch must be an array.");
      for (const record of batch) analyzePersonIdentityRecord(record, state);
      state.metrics.batchesProcessed += 1;
    }

    finalizeGroups(state);
    const duplicateProfiles =
      typeof repository.findDuplicateProfiles === "function"
        ? await repository.findDuplicateProfiles({ limit: this.maxIssueGroups })
        : [];
    state.metrics.duplicateProfileGroups = duplicateProfiles.length;

    return buildIdentityDiagnosticReport(state, {
      batchSize,
      duplicateProfiles,
      generatedAt: toIso(startedAt),
      maxRecords,
    });
  }
}

function analyzeIdentityDataset(records, options = {}) {
  if (!Array.isArray(records)) throw new TypeError("Identity dataset must be an array.");
  const maxRecords = boundedInteger(
    options.maxRecords ?? DEFAULT_MAX_RECORDS,
    "maxRecords",
    1,
    MAX_RECORDS,
  );
  if (records.length > maxRecords) throw new RangeError("Identity dataset exceeds maxRecords.");
  const state = createDiagnosticState(options.maxIssueGroups ?? DEFAULT_MAX_ISSUE_GROUPS);
  for (const record of records) analyzePersonIdentityRecord(record, state);
  if (records.length > 0) state.metrics.batchesProcessed = 1;
  finalizeGroups(state);
  return buildIdentityDiagnosticReport(state, {
    batchSize: records.length,
    duplicateProfiles: [],
    generatedAt: toIso(options.generatedAt ?? new Date(0)),
    maxRecords,
  });
}

function analyzePersonIdentityRecord(record, state = createDiagnosticState()) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new TypeError("Identity record must be an object.");
  }
  const personId = String(record.id ?? "").trim();
  if (!personId) throw new TypeError("Identity record requires id.");

  state.metrics.totalPeople += 1;
  const cpf = inspectField(record.cpf, "cpf", normalizeCpf);
  const email = inspectField(record.email, "email", normalizeEmail);
  const phones = [
    inspectField(record.telefone, "telefone", normalizePhone),
    inspectField(record.celular, "celular", normalizePhone),
  ];

  updateFieldMetrics(state, personId, cpf, "cpf");
  updateFieldMetrics(state, personId, email, "email");
  for (const phone of phones) updateFieldMetrics(state, personId, phone, "phone");
  updateRepresentationMetrics(state, cpf, email, phones);

  if (cpf.normalized) addGroup(state.cpfGroups, cpf.normalized, personId, cpf.rawVariant);
  if (email.normalized) addGroup(state.emailGroups, email.normalized, personId, email.rawVariant);
  for (const phone of phones) {
    if (phone.normalized) addGroup(state.phoneGroups, phone.normalized, personId, phone.rawVariant);
  }

  if (!cpf.normalized) {
    state.metrics.peopleWithoutStrongIdentifier += 1;
    addIssue(state, {
      count: 1,
      field: "cpf",
      issueType: IDENTITY_ISSUE_TYPES.INCOMPLETE_IDENTITY,
      personIds: [personId],
      recommendedAction: "REVIEW_BEFORE_PHYSICAL_UNIQUENESS",
      severity: IDENTITY_SEVERITIES.MEDIUM,
    });
  }

  if ([cpf, email, ...phones].some((field) => field.mapperOnly)) {
    state.metrics.mapperOnlyRecords += 1;
  } else {
    state.metrics.acceptedByBoth += 1;
  }
  if ([cpf, email, ...phones].some((field) => field.mapperWouldTruncate)) {
    state.metrics.mapperTruncationRiskRecords += 1;
  }
  return state;
}

function inspectField(value, field, normalizer) {
  const absent =
    value === undefined || value === null || (typeof value === "string" && !value.trim());
  const rawVariant = typeof value === "string" ? value : null;
  const limit =
    field === "cpf"
      ? PERSON_IDENTITY_LIMITS.cpf
      : field === "email"
        ? PERSON_IDENTITY_LIMITS.email
        : PERSON_IDENTITY_LIMITS.phone;
  try {
    return {
      absent,
      errorCode: null,
      mapperOnly: false,
      mapperWouldTruncate: value !== undefined && value !== null && String(value).length > limit,
      normalized: normalizer(value),
      rawVariant,
    };
  } catch (error) {
    return {
      absent,
      errorCode: error?.code ?? PERSON_IDENTITY_ERROR_CODES.VALUE_INVALID,
      mapperOnly: true,
      mapperWouldTruncate: value !== undefined && value !== null && String(value).length > limit,
      normalized: null,
      rawVariant,
    };
  }
}

function updateFieldMetrics(state, personId, result, metricField) {
  const prefix = metricField === "phone" ? "phone" : metricField;
  if (result.absent) state.metrics[`${prefix}Absent`] += 1;
  else if (result.normalized) state.metrics[`${prefix}Normalizable`] += 1;
  else state.metrics[`${prefix}Invalid`] += 1;

  if (result.mapperOnly) {
    state.metrics.normalizerIncompatibleValues += 1;
    addIssue(state, {
      count: 1,
      field: metricField,
      issueType: IDENTITY_ISSUE_TYPES.INVALID_IDENTIFIER,
      personIds: [personId],
      recommendedAction: "CLASSIFY_INVALID_VALUE",
      severity: metricField === "cpf" ? IDENTITY_SEVERITIES.HIGH : IDENTITY_SEVERITIES.MEDIUM,
    });
    addIssue(state, {
      count: 1,
      field: metricField,
      issueType: IDENTITY_ISSUE_TYPES.LEGACY_INCOMPATIBILITY,
      personIds: [personId],
      recommendedAction: "HUMAN_REVIEW_REQUIRED",
      severity: metricField === "cpf" ? IDENTITY_SEVERITIES.HIGH : IDENTITY_SEVERITIES.MEDIUM,
    });
  }
}

function finalizeGroups(state) {
  for (const group of state.cpfGroups.values()) {
    if (group.personIds.size < 2) continue;
    state.metrics.duplicateCpfGroups += 1;
    if (group.variants.size === 1) state.metrics.duplicateCpfExactGroups += 1;
    else state.metrics.duplicateCpfNormalizedVariationGroups += 1;
    state.metrics.peopleInDuplicateCpfGroups += group.personIds.size;
    addIssue(
      state,
      groupIssue(
        group,
        "cpf",
        IDENTITY_ISSUE_TYPES.DUPLICATE_STRONG_IDENTIFIER,
        IDENTITY_SEVERITIES.CRITICAL,
        "BLOCK_UNIQUE_INDEX_AND_REVIEW",
      ),
    );
    if (group.variants.size > 1) recordFormatVariation(state, group, "cpf");
  }
  finalizeContactGroups(state, state.emailGroups, "email", "sharedEmailGroups");
  finalizeContactGroups(state, state.phoneGroups, "phone", "sharedPhoneGroups");
}

function finalizeContactGroups(state, groups, field, metric) {
  for (const group of groups.values()) {
    if (group.personIds.size < 2) continue;
    state.metrics[metric] += 1;
    const exactMetric = field === "email" ? "sharedEmailExactGroups" : "sharedPhoneExactGroups";
    const variationMetric =
      field === "email"
        ? "sharedEmailNormalizedVariationGroups"
        : "sharedPhoneNormalizedVariationGroups";
    if (group.variants.size === 1) state.metrics[exactMetric] += 1;
    else state.metrics[variationMetric] += 1;
    addIssue(
      state,
      groupIssue(
        group,
        field,
        IDENTITY_ISSUE_TYPES.SHARED_CONTACT,
        IDENTITY_SEVERITIES.LOW,
        "PRESERVE_SHARED_CONTACT_AND_REVIEW_CONTEXT",
      ),
    );
    if (group.variants.size > 1) recordFormatVariation(state, group, field);
  }
}

function recordFormatVariation(state, group, field) {
  state.metrics.formatVariationGroups += 1;
  addIssue(
    state,
    groupIssue(
      group,
      field,
      IDENTITY_ISSUE_TYPES.FORMAT_VARIATION,
      IDENTITY_SEVERITIES.MEDIUM,
      "ELIGIBLE_FOR_CONTROLLED_NORMALIZATION_REVIEW",
    ),
  );
}

function groupIssue(group, field, issueType, severity, recommendedAction) {
  return {
    count: group.personIds.size,
    field,
    issueType,
    personIds: [...group.personIds].sort(),
    recommendedAction,
    severity,
  };
}

function createDiagnosticState(maxIssueGroups = DEFAULT_MAX_ISSUE_GROUPS) {
  return {
    cpfGroups: new Map(),
    emailGroups: new Map(),
    issues: [],
    maxIssueGroups: boundedInteger(maxIssueGroups, "maxIssueGroups", 1, 1000),
    metrics: {
      acceptedByBoth: 0,
      batchesProcessed: 0,
      cpfAbsent: 0,
      cpfCanonical: 0,
      cpfInvalid: 0,
      cpfMasked: 0,
      cpfNormalizable: 0,
      duplicateCpfExactGroups: 0,
      duplicateCpfGroups: 0,
      duplicateCpfNormalizedVariationGroups: 0,
      duplicateProfileGroups: 0,
      emailAbsent: 0,
      emailAliasPreserved: 0,
      emailCaseVariation: 0,
      emailInvalid: 0,
      emailNormalizable: 0,
      emailSpaceVariation: 0,
      formatVariationGroups: 0,
      mapperOnlyRecords: 0,
      mapperTruncationRiskRecords: 0,
      normalizerIncompatibleValues: 0,
      peopleInDuplicateCpfGroups: 0,
      peopleWithoutStrongIdentifier: 0,
      phoneAbsent: 0,
      phoneInternational: 0,
      phoneInvalid: 0,
      phoneMasked: 0,
      phoneNationalUnmasked: 0,
      phoneNormalizable: 0,
      sharedEmailExactGroups: 0,
      sharedEmailGroups: 0,
      sharedEmailNormalizedVariationGroups: 0,
      sharedPhoneExactGroups: 0,
      sharedPhoneGroups: 0,
      sharedPhoneNormalizedVariationGroups: 0,
      totalPeople: 0,
    },
    phoneGroups: new Map(),
  };
}

function updateRepresentationMetrics(state, cpf, email, phones) {
  if (cpf.normalized && typeof cpf.rawVariant === "string") {
    if (cpf.rawVariant.trim() === cpf.normalized) state.metrics.cpfCanonical += 1;
    else state.metrics.cpfMasked += 1;
  }
  if (email.normalized && typeof email.rawVariant === "string") {
    const trimmed = email.rawVariant.trim();
    if (email.rawVariant !== trimmed) state.metrics.emailSpaceVariation += 1;
    if (trimmed !== trimmed.toLowerCase()) state.metrics.emailCaseVariation += 1;
    if (trimmed.slice(0, trimmed.indexOf("@")).includes("+")) {
      state.metrics.emailAliasPreserved += 1;
    }
  }
  for (const phone of phones) {
    if (!phone.normalized || typeof phone.rawVariant !== "string") continue;
    const trimmed = phone.rawVariant.trim();
    if (trimmed.startsWith("+")) state.metrics.phoneInternational += 1;
    if (/[().\-\s]/u.test(trimmed)) state.metrics.phoneMasked += 1;
    else if (!trimmed.startsWith("+")) state.metrics.phoneNationalUnmasked += 1;
  }
}

function addGroup(map, normalized, personId, rawVariant) {
  const group = map.get(normalized) ?? { personIds: new Set(), variants: new Set() };
  group.personIds.add(personId);
  if (typeof rawVariant === "string") group.variants.add(rawVariant);
  map.set(normalized, group);
}

function addIssue(state, issue) {
  if (state.issues.length >= state.maxIssueGroups) return;
  state.issues.push(Object.freeze({ ...issue, personIds: Object.freeze([...issue.personIds]) }));
}

function buildIdentityDiagnosticReport(state, options) {
  const duplicateProfiles = options.duplicateProfiles.map((profile) =>
    Object.freeze({
      activeCount: profile.activeCount,
      count: profile.profileCount,
      personIds: Object.freeze([profile.personId]),
      profileType: profile.profileType,
      severity: profile.activeCount > 1 ? IDENTITY_SEVERITIES.HIGH : IDENTITY_SEVERITIES.MEDIUM,
      statusConflict: profile.statusCount > 1,
    }),
  );
  return Object.freeze({
    contractVersion: IDENTITY_DIAGNOSTIC_CONTRACT_VERSION,
    generatedAt: options.generatedAt,
    limits: Object.freeze({
      batchSize: options.batchSize,
      maxIssueGroups: state.maxIssueGroups,
      maxRecords: options.maxRecords,
    }),
    metrics: Object.freeze({ ...state.metrics }),
    profileIssues: Object.freeze(duplicateProfiles),
    safeIssues: Object.freeze([...state.issues]),
  });
}

function createReadOnlyQueryRunner(queryRunner) {
  return async (sql, params = []) => {
    if (!/^\s*SELECT\b/iu.test(sql) || /;\s*\S/u.test(sql)) {
      throw new Error("Identity diagnostic repository accepts SELECT only.");
    }
    return queryRunner(sql, params);
  };
}

async function runPersonIdentityDiagnostic({ close = null, repository, service, options = {} }) {
  try {
    return await service.analyzeRepository(repository, options);
  } finally {
    if (typeof close === "function") await close();
  }
}

function boundedInteger(value, field, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new RangeError(`${field} must be an integer between ${minimum} and ${maximum}.`);
  }
  return number;
}

function safeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0;
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new TypeError("Diagnostic clock must return a valid date.");
  return date.toISOString();
}

module.exports = Object.freeze({
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_RECORDS,
  DUPLICATE_PROFILES_SQL,
  IDENTITY_DIAGNOSTIC_CONTRACT_VERSION,
  IDENTITY_ISSUE_TYPES,
  IDENTITY_SEVERITIES,
  MAX_BATCH_SIZE,
  MAX_RECORDS,
  PEOPLE_IDENTITY_PAGE_SQL,
  PersonIdentityDiagnosticReadRepository,
  PersonIdentityDiagnosticService,
  analyzeIdentityDataset,
  analyzePersonIdentityRecord,
  buildIdentityDiagnosticReport,
  createReadOnlyQueryRunner,
  runPersonIdentityDiagnostic,
});
