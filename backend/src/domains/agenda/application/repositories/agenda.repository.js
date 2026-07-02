/**
 * Repository contract for the Agenda backend domain.
 *
 * This file defines the read-only interface expected by the application layer.
 * It does not instantiate adapters, execute SQL or create schedules,
 * attendance records, recurrence rows, financial entries or notifications.
 *
 * @typedef {Object} AgendaRepository
 * @property {({ classId }: { classId?: string|number|null }) => Promise<Record<string, unknown>[]>} findSchedulesByClass
 *   Read-only lookup for class-derived schedules.
 * @property {({ studentPersonId, studentProfileId }: { studentPersonId?: string|null, studentProfileId?: string|null }) => Promise<Record<string, unknown>[]>} findSchedulesByStudent
 *   Read-only lookup scoped by student person/profile.
 * @property {({ enrollmentId }: { enrollmentId?: string|null }) => Promise<Record<string, unknown>[]>} findSchedulesByEnrollment
 *   Read-only lookup scoped by an ACTIVE enrollment.
 * @property {({ studentPersonId, studentProfileId }: { studentPersonId?: string|null, studentProfileId?: string|null }) => Promise<Record<string, unknown>>} getAgendaSummaryByStudent
 *   Read-only summary scoped by student person/profile.
 * @property {({ enrollmentId, classId, studentPersonId, studentProfileId, scheduleCandidates, requestedBy }: { enrollmentId?: string|null, classId?: string|number|null, studentPersonId?: string|null, studentProfileId?: string|null, scheduleCandidates?: Record<string, unknown>[], requestedBy?: string|null }) => Promise<Record<string, unknown>>} [createInitialAgendaForEnrollment]
 *   Idempotent persistence of initial Agenda items. It must not create
 *   attendance records, financial records or notifications.
 */

module.exports = {};
