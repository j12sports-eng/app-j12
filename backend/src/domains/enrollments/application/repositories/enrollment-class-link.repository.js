/**
 * Repository contract for Enrollment -> Turma link persistence.
 *
 * This file intentionally defines only the expected interface. It does not
 * implement persistence, instantiate adapters, execute SQL or import database
 * modules.
 *
 * @typedef {Object} EnrollmentClassLinkRepository
 * @property {(input: { enrollmentId: string, classId: string|number, linkedBy?: string|null, linkedAt?: string|null, origin?: string|null, metadata?: Record<string, unknown> }) => Promise<{ link: unknown|null, created: boolean, reused: boolean }>} createActiveLinkIfNotExists
 *   Creates an ACTIVE Enrollment -> Turma link or reuses the existing active
 *   link for the same enrollment/class pair.
 * @property {(input: { enrollmentId: string, classId: string|number, linkedBy?: string|null, linkedAt?: string|null, origin?: string|null, metadata?: Record<string, unknown> }) => Promise<unknown|null>} [createOrReuseActiveLink]
 *   Backward-compatible alias for older internal callers.
 * @property {(id: string|number) => Promise<unknown|null>} findById
 * @property {(input: { enrollmentId: string, classId: string|number }) => Promise<unknown|null>} findActiveByEnrollmentAndClass
 * @property {(input: { classId: string|number }) => Promise<{ classId: number, activeLinkCount: number, capacity: null, availableCapacity: null }>} [getClassCapacitySnapshot]
 * @property {(input: { enrollmentId: string, classId: string|number, unlinkedBy?: string|null, unlinkedAt?: string|null }) => Promise<unknown|null>} unlinkActiveLink
 */

module.exports = {};
