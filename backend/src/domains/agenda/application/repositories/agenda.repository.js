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
 * @property {({ dayOfWeek, startTime, endTime, lockForUpdate }: { dayOfWeek?: string|number|null, startTime?: string|null, endTime?: string|null, lockForUpdate?: boolean }) => Promise<Record<string, unknown>[]>} [findAgendaConflictCandidates]
 *   Read candidates for centralized conflict validation.
 * @property {({ date, dayOfWeek, startTime, endTime }: { date?: string|null, dayOfWeek?: string|number|null, startTime?: string|null, endTime?: string|null }) => Promise<Record<string, unknown>[]>} [findAgendaAdministrativeBlocks]
 *   Read administrative blocked times/unavailable dates when the optional schema exists.
 * @property {({ agendaItemId, dayOfWeek, startTime, endTime }: { agendaItemId?: string|null, dayOfWeek?: string|number|null, startTime?: string|null, endTime?: string|null }) => Promise<Record<string, unknown>|null>} [updateAgendaItemSchedule]
 *   Persist a validated reschedule for a canonical Agenda item only.
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>>} [createRecurrenceSeries]
 *   Idempotent persistence for a recurrence series. Must not create
 *   attendance, financial records or notifications.
 * @property {({ seriesId }: { seriesId?: string|null }) => Promise<Record<string, unknown>|null>} [findRecurrenceSeriesById]
 *   Reads one recurrence series and its Prisma-compatible scalar fields.
 * @property {({ seriesId, startDate, endDate }: { seriesId?: string|null, startDate?: string|null, endDate?: string|null }) => Promise<Record<string, unknown>[]>} [findRecurrenceExceptions]
 *   Reads recurrence exceptions for occurrence generation and highlighting.
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>>} [createRecurrenceException]
 *   Idempotent occurrence-level cancel/edit exception persistence.
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>|null>} [updateRecurrenceSeries]
 *   Updates a whole recurrence series after conflict validation.
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>|null>} [cancelRecurrenceSeries]
 *   Cancels a whole recurrence series without deleting historical rows.
 * @property {(input: Record<string, unknown>) => Promise<Record<string, unknown>>} [splitRecurrenceSeries]
 *   Ends the current series and creates a linked future series for
 *   "this and following" edits.
 * @property {(work: (repository: AgendaRepository) => Promise<unknown>) => Promise<unknown>} [withAgendaTransaction]
 *   Runs validation and persistence in one database transaction.
 */

module.exports = {};
