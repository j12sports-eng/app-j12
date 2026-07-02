/**
 * Repository contract for future Enrollment persistence.
 *
 * This file intentionally defines only the expected interface. It does not
 * implement persistence, instantiate adapters, access Prisma, execute SQL or
 * import database modules.
 *
 * @typedef {Object} EnrollmentRepository
 * @property {(enrollment: import("../../domain/entities/enrollment.entity.js").Enrollment|Record<string, unknown>) => Promise<unknown>} create
 * @property {(enrollment: import("../../domain/entities/enrollment.entity.js").Enrollment|Record<string, unknown>) => Promise<{ enrollment: unknown|null, created: boolean, reused: boolean }>} createDraftIfNotExists
 * @property {(id: string) => Promise<unknown|null>} findById
 *   Read-only lookup by aggregate id used by internal confirmation flows.
 * @property {(studentPersonId: string) => Promise<unknown[]>} findByStudentPersonId
 * @property {({ studentPersonId, studentProfileId }: { studentPersonId?: string|null, studentProfileId?: string|null }) => Promise<unknown|null>} findActiveByStudent
 *   Read-only adapter method used by the application service to resolve the current ACTIVE Enrollment.
 * @property {({ studentPersonId, studentProfileId }: { studentPersonId?: string|null, studentProfileId?: string|null }) => Promise<unknown|null>} findDraftByStudent
 *   Read-only adapter method used by the application service to resolve the current active DRAFT.
 * @property {(studentPersonId: string) => Promise<unknown|null>} findDraftByStudentPersonId
 * @property {(studentProfileId: string) => Promise<unknown|null>} findDraftByStudentProfileId
 * @property {(id: string, status: string, options?: { confirmedAt?: string|null, confirmedBy?: string|null }) => Promise<unknown|null>} updateStatus
 *   Updates the Enrollment status, confirmation audit metadata when activating,
 *   and updated_at.
 * @property {(id: string, data: Record<string, unknown>) => Promise<unknown|null>} update
 * @property {(id: string) => Promise<boolean>} delete
 */

module.exports = {};
