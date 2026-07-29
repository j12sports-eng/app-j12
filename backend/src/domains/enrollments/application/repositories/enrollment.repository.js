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
 * @property {(enrollment: unknown) => Promise<void>} validateDraftOwnership
 *   Validates canonical unit, responsible, profiles, student and relationship before modern persistence.
 * @property {({ responsiblePersonId, studentPersonId, unitId }: { responsiblePersonId: string, studentPersonId: string, unitId: string }) => Promise<Record<string, unknown>>} resolveDraftOpeningOwnership
 *   Resolves the unique active canonical profiles and responsible relationship for administrative DRAFT opening.
 * @property {(studentPersonId: string) => Promise<unknown[]>} findByStudentPersonId
 * @property {({ studentPersonId, studentProfileId }: { studentPersonId?: string|null, studentProfileId?: string|null }) => Promise<unknown|null>} findActiveByStudent
 *   Read-only adapter method used by the application service to resolve the current ACTIVE Enrollment.
 *   The input contract also requires canonical unitId.
 * @property {({ studentPersonId, studentProfileId }: { studentPersonId?: string|null, studentProfileId?: string|null }) => Promise<unknown|null>} findDraftByStudent
 *   Read-only adapter method used by the application service to resolve the current active DRAFT.
 *   The input contract also requires canonical unitId.
 * @property {(studentPersonId: string) => Promise<unknown|null>} findDraftByStudentPersonId
 * @property {(studentProfileId: string) => Promise<unknown|null>} findDraftByStudentProfileId
 * @property {({ enrollmentId, expectedStatus, status }: { enrollmentId?: string|null, expectedStatus?: string|null, status?: string|null }) => Promise<{ changed: boolean }>} cancelActiveEnrollment
 *   Conditionally cancels an ACTIVE Enrollment without touching class links or integrations.
 * @property {(id: string, status: string, options?: { confirmedAt?: string|null, confirmedBy?: string|null }) => Promise<unknown|null>} updateStatus
 *   Updates the Enrollment status, confirmation audit metadata when activating,
 *   and updated_at. Confirmation requires unitId and expectedStatus options.
 * @property {(id: string, data: Record<string, unknown>) => Promise<unknown|null>} update
 * @property {(id: string) => Promise<boolean>} delete
 */

module.exports = {};
