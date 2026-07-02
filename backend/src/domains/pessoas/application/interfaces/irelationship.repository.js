/**
 * @typedef {Object} IRelationshipRepository
 * @property {(relationshipId: string) => Promise<unknown|null>} findById
 * @property {(payload: unknown) => Promise<unknown|null>} findActiveDuplicate
 * @property {(payload: unknown) => Promise<unknown>} create
 */

module.exports = {};
