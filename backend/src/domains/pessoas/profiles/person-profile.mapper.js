const PERSON_PROFILE_TYPES = Object.freeze({
  ALUNO: "aluno",
  FUNCIONARIO: "funcionario",
  LOCATARIO: "locatario",
  PROFESSOR: "professor",
  RESPONSAVEL: "responsavel",
});

const PERSON_PROFILE_STATUS = Object.freeze({
  ATIVO: "ativo",
  BLOQUEADO: "bloqueado",
  INATIVO: "inativo",
  PENDENTE: "pendente",
});

const PERSON_PROFILE_TYPE_VALUES = Object.freeze(Object.values(PERSON_PROFILE_TYPES));
const PERSON_PROFILE_STATUS_VALUES = Object.freeze(Object.values(PERSON_PROFILE_STATUS));

/**
 * @typedef {Object} PersonProfileData
 * @property {string|null} [id]
 * @property {string|null} [personId]
 * @property {string|null} [profileType]
 * @property {string|null} [status]
 * @property {string|null} [createdAt]
 * @property {string|null} [updatedAt]
 */

/**
 * Maps plain data into the Person Profile persistence DTO.
 *
 * @param {Record<string, unknown>} [data]
 * @returns {PersonProfileData}
 */
function toPersonProfileData(data = {}) {
  return {
    createdAt: data.createdAt ?? data.created_at ?? null,
    id: data.id ?? null,
    personId: data.personId ?? data.person_id ?? null,
    profileType: normalizeProfileType(data.profileType ?? data.profile_type),
    status: normalizeProfileStatus(data.status),
    updatedAt: data.updatedAt ?? data.updated_at ?? null,
  };
}

/**
 * Maps a database row from `person_profiles` into domain data.
 *
 * @param {Record<string, unknown>|null|undefined} row
 * @returns {PersonProfileData|null}
 */
function toPersonProfileDataFromRow(row) {
  if (!row) return null;
  return toPersonProfileData(row);
}

/**
 * Maps profile data into `person_profiles` column values.
 *
 * @param {Record<string, unknown>} [data]
 * @returns {Record<string, unknown>}
 */
function toPersonProfileRowValues(data = {}) {
  const profile = toPersonProfileData(data);

  return {
    id: nullableText(profile.id, 64),
    person_id: text(profile.personId, 64),
    profile_type: text(profile.profileType, 50),
    status: text(profile.status || PERSON_PROFILE_STATUS.ATIVO, 30),
  };
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeProfileType(value) {
  const normalized = nullableText(value, 50);
  return normalized ? normalized.toLowerCase() : null;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeProfileStatus(value) {
  const normalized = nullableText(value, 30);
  return normalized ? normalized.toLowerCase() : PERSON_PROFILE_STATUS.ATIVO;
}

/**
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string}
 */
function text(value, max = 65535) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

/**
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string|null}
 */
function nullableText(value, max = 65535) {
  const normalized = text(value, max);
  return normalized || null;
}

module.exports = {
  PERSON_PROFILE_STATUS,
  PERSON_PROFILE_STATUS_VALUES,
  PERSON_PROFILE_TYPES,
  PERSON_PROFILE_TYPE_VALUES,
  toPersonProfileData,
  toPersonProfileDataFromRow,
  toPersonProfileRowValues,
};
