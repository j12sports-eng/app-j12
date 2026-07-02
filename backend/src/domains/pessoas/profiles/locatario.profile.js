/**
 * Domain model for the future Locatario profile.
 *
 * This file documents the role, responsibilities and domain attributes of a
 * person acting as a locatario. It has no persistence, no SQL, no endpoints
 * and no integration with the current quadras or locacao flows.
 */

const LOCATARIO_PROFILE_ROLE = Object.freeze({
  key: "locatario",
  name: "Locatario",
  description: "Pessoa que aluga quadras, horarios ou estruturas esportivas da J12.",
});

const LOCATARIO_PROFILE_RESPONSIBILITIES = Object.freeze([
  "Representar o vinculo comercial do locatario com locacoes de quadras.",
  "Concentrar preferencias, contratos, quadras e historico operacional futuro.",
  "Permitir relacionamento futuro com agenda, financeiro, contratos e notificacoes.",
]);

const LOCATARIO_PROFILE_ATTRIBUTES = Object.freeze([
  "personId",
  "status",
  "quadraIds",
  "contratoIds",
  "preferenciasHorario",
  "responsavelPagamento",
  "observacoes",
]);

/**
 * @typedef {Object} LocatarioProfileData
 * @property {string|null} [personId] Future identifier of the related Person.
 * @property {string|null} [status] Domain status for the locatario profile.
 * @property {string[]} [quadraIds] Future linked court identifiers.
 * @property {string[]} [contratoIds] Future linked contract identifiers.
 * @property {string[]} [preferenciasHorario] Preferred rental time windows.
 * @property {boolean|null} [responsavelPagamento] Indicates payment ownership.
 * @property {string|null} [observacoes] Operational notes for the profile.
 */

class LocatarioProfile {
  /**
   * @param {LocatarioProfileData} [data]
   */
  constructor(data = {}) {
    this.personId = data.personId ?? null;
    this.status = data.status ?? null;
    this.quadraIds = Array.isArray(data.quadraIds) ? data.quadraIds : [];
    this.contratoIds = Array.isArray(data.contratoIds) ? data.contratoIds : [];
    this.preferenciasHorario = Array.isArray(data.preferenciasHorario)
      ? data.preferenciasHorario
      : [];
    this.responsavelPagamento = data.responsavelPagamento ?? null;
    this.observacoes = data.observacoes ?? null;
  }

  /**
   * Returns the profile as plain data for future mappers.
   *
   * @returns {LocatarioProfileData}
   */
  toJSON() {
    return {
      contratoIds: this.contratoIds,
      observacoes: this.observacoes,
      personId: this.personId,
      preferenciasHorario: this.preferenciasHorario,
      quadraIds: this.quadraIds,
      responsavelPagamento: this.responsavelPagamento,
      status: this.status,
    };
  }
}

LocatarioProfile.role = LOCATARIO_PROFILE_ROLE;
LocatarioProfile.responsibilities = LOCATARIO_PROFILE_RESPONSIBILITIES;
LocatarioProfile.attributes = LOCATARIO_PROFILE_ATTRIBUTES;

module.exports = {
  LOCATARIO_PROFILE_ATTRIBUTES,
  LOCATARIO_PROFILE_RESPONSIBILITIES,
  LOCATARIO_PROFILE_ROLE,
  LocatarioProfile,
};
