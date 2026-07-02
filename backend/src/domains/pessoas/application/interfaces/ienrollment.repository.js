/**
 * @typedef {Object} IEnrollmentRepository
 * @property {(enrollmentId: string) => Promise<unknown|null>} findById
 * @property {(enrollmentNumber: string) => Promise<unknown|null>} findByNumber
 * @property {(payload: unknown) => Promise<unknown>} create
 */

module.exports = {};
