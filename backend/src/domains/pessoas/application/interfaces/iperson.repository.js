/**
 * @typedef {Object} IPersonRepository
 * @property {(personId: string) => Promise<unknown|null>} findById
 * @property {(cpf: string) => Promise<unknown|null>} findByCpf
 * @property {(cpfNormalized: string) => Promise<Array<{ id: string }>>} findIdentityCandidatesByNormalizedCpf
 * @property {(payload: unknown) => Promise<unknown>} create
 */

module.exports = {};
