/**
 * @typedef {Object} IProfileRepository
 * @property {(profileId: string) => Promise<unknown|null>} findById
 * @property {(personId: string, profileType: string) => Promise<unknown|null>} findByPersonAndType
 * @property {(payload: unknown) => Promise<unknown>} create
 */

module.exports = {};
