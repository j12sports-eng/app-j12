export type AgendaLookupMode = "student" | "enrollment" | "class";

export type AgendaCalendarView = "day" | "week" | "month";

export type AgendaRecurrenceFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM";

export type AgendaRecurrenceIntervalUnit = "DAY" | "WEEK" | "MONTH";

export type AgendaRecurrenceOperationScope = "THIS_OCCURRENCE" | "THIS_AND_FOLLOWING" | "SERIES";

export type AgendaRecurrenceExceptionType = "CANCELLED" | "MODIFIED";

export type AgendaAttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "JUSTIFIED"
  | "LATE"
  | "REPLACEMENT"
  | "PENDING"
  | "NOT_REGISTERED"
  | "UNKNOWN";

export type AgendaClassStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "CANCELLED"
  | "COMPLETED"
  | "SCHEDULED"
  | "UNKNOWN";

export type AgendaScheduleStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "CANCELLED"
  | "COMPLETED"
  | "PLANNED"
  | "UNKNOWN";

export type AgendaBlocker = {
  code?: string | null;
  details?: Record<string, unknown> | null;
  message?: string | null;
};

export type AgendaSchedule = {
  agendaItemId?: string | null;
  agendaSource?: string | null;
  attendanceDate?: string | null;
  attendanceRegisteredAt?: string | null;
  attendanceStatus?: AgendaAttendanceStatus | string | null;
  classId?: string | number | null;
  className?: string | null;
  classStatus?: AgendaClassStatus | string | null;
  courtId?: string | number | null;
  courtName?: string | null;
  dayOfWeek?: string | number | null;
  daysOfWeek?: Array<string | number>;
  endTime?: string | null;
  enrollmentId?: string | null;
  id?: string | null;
  modality?: string | null;
  observations?: string | null;
  persistedAgenda?: boolean;
  present?: boolean | null;
  professorId?: string | number | null;
  professorName?: string | null;
  quadraId?: string | number | null;
  quadraName?: string | null;
  recurrence?: string | null;
  recurrenceEndDate?: string | null;
  recurrenceExceptionType?: AgendaRecurrenceExceptionType | string | null;
  recurrenceFrequency?: AgendaRecurrenceFrequency | string | null;
  recurrenceIntervalUnit?: AgendaRecurrenceIntervalUnit | string | null;
  recurrenceIntervalValue?: number | null;
  recurrenceMaxOccurrences?: number | null;
  recurrenceOccurrenceKey?: string | null;
  recurrenceSeriesId?: string | null;
  recurrenceStartDate?: string | null;
  recurrenceType?: AgendaRecurrenceFrequency | string | null;
  replacementOfAgendaItemId?: string | null;
  scheduleDate?: string | null;
  scheduleStatus?: AgendaScheduleStatus | string | null;
  source?: string | null;
  startTime?: string | null;
  status?: string | null;
  studentPersonId?: string | null;
  studentProfileId?: string | null;
  turmaName?: string | null;
  unitName?: string | null;
};

export type AgendaNotificationRecipient = {
  email?: string | null;
  id?: string | number | null;
  name?: string | null;
  phoneWhatsapp?: string | null;
  recipientId?: string | number | null;
  recipientType?: "ADMIN" | "PROFESSOR" | "RESPONSIBLE" | "STUDENT" | string;
  type?: "ADMIN" | "PROFESSOR" | "RESPONSIBLE" | "STUDENT" | string;
  whatsapp?: string | null;
};

export type AgendaNotificationSummary = {
  agendaNotificationQueued?: boolean;
  emailPrepared?: boolean;
  noExternalMessageSentSynchronously?: boolean;
  pushPrepared?: boolean;
  queuedCount?: number;
  whatsappPrepared?: boolean;
};

export type AgendaNotificationWarning = {
  code?: string | null;
  message?: string | null;
};

export type AgendaAdminSummaryResponse = {
  agendaItems?: AgendaSchedule[];
  agendaSource?: string | null;
  blockers?: AgendaBlocker[];
  classCount?: number;
  classId?: string | number | null;
  classIds?: Array<string | number>;
  enrollmentId?: string | null;
  enrollmentStatus?: string | null;
  hasSchedule?: boolean;
  hasSchedules?: boolean;
  limitations?: string[];
  noAttendanceCreated?: boolean;
  noFinancialSideEffects?: boolean;
  noNotificationSideEffects?: boolean;
  noScheduleCreated?: boolean;
  readOnly?: boolean;
  scheduleCandidateCount?: number;
  scheduleCandidates?: AgendaSchedule[];
  scheduleCount?: number;
  schedules?: AgendaSchedule[];
  scopeResolved?: boolean;
  studentPersonId?: string | null;
  studentProfileId?: string | null;
  usesClassFacade?: boolean;
  usesEnrollmentFacade?: boolean;
};

export type AgendaClassSchedulesResponse = {
  agendaSource?: string | null;
  classId?: string | number | null;
  noAttendanceCreated?: boolean;
  noFinancialSideEffects?: boolean;
  noNotificationSideEffects?: boolean;
  readOnly?: boolean;
  scheduleCount?: number;
  schedules: AgendaSchedule[];
};

export type AgendaLookupInput = {
  classId?: string | null;
  enabled?: boolean;
  enrollmentId?: string | null;
  limit?: number;
  mode: AgendaLookupMode;
  studentPersonId?: string | null;
  studentProfileId?: string | null;
};

export type PreparedAttendanceDraft = {
  agendaItemId?: string | null;
  blockedReason?: string | null;
  classId?: string | number | null;
  enrollmentId?: string | null;
  noAttendanceCreated: true;
  noFinancialSideEffects: true;
  noNotificationSideEffects: true;
  preparedAttendanceDraft: true;
  scheduleDate?: string | null;
  scheduleLabel: string;
  startTime?: string | null;
  status: "DRAFT";
  studentPersonId?: string | null;
  studentProfileId?: string | null;
};

export type AgendaCalendarPeriod = {
  endDate: Date;
  label: string;
  startDate: Date;
  view: AgendaCalendarView;
};

export type AgendaCalendarEvent = {
  date: Date;
  dateKey: string;
  exceptionType?: AgendaRecurrenceExceptionType | string | null;
  id: string;
  isException?: boolean;
  isPast: boolean;
  isRecurringProjection: boolean;
  isToday: boolean;
  recurrenceOccurrenceKey?: string | null;
  recurrenceSeriesId?: string | null;
  schedule: AgendaSchedule;
  subtitle: string;
  timeLabel: string;
  title: string;
};

export type AgendaReschedulePayload = {
  agendaItemId?: string | null;
  calendarEventId?: string | null;
  classId?: string | number | null;
  courtId?: string | number | null;
  courtName?: string | null;
  enrollmentId?: string | null;
  fromDate?: string | null;
  fromEndTime?: string | null;
  fromStartTime?: string | null;
  noFinancialSideEffects: true;
  noNotificationSideEffects: boolean;
  notificationChannels?: Array<"EMAIL" | "IN_APP" | "PUSH" | "WHATSAPP" | string>;
  notificationEventType?: string | null;
  notificationIdempotencyKey?: string | null;
  notificationMessage?: string | null;
  notificationRecipients?: AgendaNotificationRecipient[];
  notificationTitle?: string | null;
  notificationType?: string | null;
  professorId?: string | number | null;
  professorName?: string | null;
  quadraId?: string | number | null;
  quadraName?: string | null;
  reason?: string | null;
  scheduleId?: string | null;
  studentPersonId?: string | null;
  studentProfileId?: string | null;
  toDate: string;
  toEndTime?: string | null;
  toStartTime: string;
};

export type AgendaRescheduleResponse = {
  agendaNotification?: AgendaNotificationSummary;
  agendaNotificationWarning?: AgendaNotificationWarning;
  agendaConflictValidation?: AgendaConflictValidationResponse;
  agendaDragDropRescheduleEnabled?: boolean;
  conflictDetected?: boolean;
  conflicts?: AgendaConflict[];
  message?: string | null;
  noBackendSchemaChange?: boolean;
  noFinancialSideEffects?: boolean;
  noNotificationSideEffects?: boolean;
  notificationSideEffects?: boolean;
  schedule?: AgendaSchedule | null;
  schedules?: AgendaSchedule[];
  updatedSchedule?: AgendaSchedule | null;
  warnings?: AgendaConflict[];
};

export type AgendaRescheduleTarget = {
  courtId?: string | number | null;
  courtName?: string | null;
  date: Date;
  endTime?: string | null;
  professorId?: string | number | null;
  professorName?: string | null;
  quadraId?: string | number | null;
  quadraName?: string | null;
  reason?: string | null;
  startTime?: string | null;
};

export type AgendaMoveValidation = {
  conflictEventId?: string | null;
  ok: boolean;
  reason?: string | null;
};

export type AgendaConflictSeverity = "CRITICAL" | "WARNING";

export type AgendaConflict = {
  blocking?: boolean;
  code?: string | null;
  conflictEventId?: string | null;
  details?: Record<string, unknown> | null;
  message?: string | null;
  resourceId?: string | null;
  resourceType?: string | null;
  severity?: AgendaConflictSeverity | string | null;
};

export type AgendaConflictValidationPayload = AgendaReschedulePayload & {
  action?: "CREATE" | "EDIT" | "MOVE" | "RESCHEDULE" | "VALIDATE" | string;
  blockOnWarnings?: boolean;
  capacityAffectsEnrollment?: boolean;
  eventId?: string | null;
  isRecurringProjection?: boolean;
  recurrenceUpdateScope?: string | null;
  unavailableDates?: string[];
};

export type AgendaConflictValidationResponse = {
  agendaConflictValidationEnabled?: boolean;
  blocked?: boolean;
  canConfirm?: boolean;
  conflictDetected?: boolean;
  conflicts?: AgendaConflict[];
  criticalConflicts?: AgendaConflict[];
  hasCriticalConflicts?: boolean;
  hasWarnings?: boolean;
  normalizedEvent?: Record<string, unknown> | null;
  ok?: boolean;
  validationCode?: string | null;
  warnings?: AgendaConflict[];
  warningsBlockConfirmation?: boolean;
};

export type AgendaRecurrenceException = {
  createdAt?: string | null;
  createdBy?: string | null;
  exceptionType?: AgendaRecurrenceExceptionType | string | null;
  id?: string | null;
  occurrenceDate?: string | null;
  occurrenceKey?: string | null;
  occurrenceStartTime?: string | null;
  override?: Record<string, unknown> | null;
  reason?: string | null;
  seriesId?: string | null;
};

export type AgendaRecurrenceRule = {
  agendaItemId?: string | null;
  classId?: string | number | null;
  classLinkId?: string | null;
  courtId?: string | number | null;
  courtName?: string | null;
  daysOfWeek?: Array<string | number>;
  endDate?: string | null;
  endTime?: string | null;
  enrollmentId?: string | null;
  exceptions?: AgendaRecurrenceException[];
  frequency: AgendaRecurrenceFrequency | string;
  id?: string | null;
  intervalUnit?: AgendaRecurrenceIntervalUnit | string | null;
  intervalValue?: number | null;
  maxOccurrences?: number | null;
  parentSeriesId?: string | null;
  professorId?: string | number | null;
  professorName?: string | null;
  source?: string | null;
  startDate: string;
  startTime: string;
  studentPersonId?: string | null;
  studentProfileId?: string | null;
  timezone?: string | null;
};

export type AgendaRecurrenceOccurrence = {
  date?: string | null;
  endTime?: string | null;
  exceptionType?: AgendaRecurrenceExceptionType | string | null;
  id?: string | null;
  isException?: boolean;
  isRecurringProjection?: boolean;
  occurrenceIndex?: number;
  occurrenceKey?: string | null;
  originalDate?: string | null;
  recurrenceSeriesId?: string | null;
  schedule?: AgendaSchedule | null;
  startTime?: string | null;
  status?: string | null;
};

export type AgendaRecurrenceResponse = {
  agendaNotification?: AgendaNotificationSummary;
  agendaNotificationWarning?: AgendaNotificationWarning;
  agendaConflictValidation?: AgendaConflictValidationResponse | null;
  exception?: AgendaRecurrenceException | null;
  exceptions?: AgendaRecurrenceException[];
  noAttendanceCreated?: boolean;
  noDuplicateOccurrences?: boolean;
  noFinancialSideEffects?: boolean;
  noNotificationSideEffects?: boolean;
  notificationSideEffects?: boolean;
  occurrence?: AgendaRecurrenceOccurrence | null;
  occurrenceCount?: number;
  occurrences?: AgendaRecurrenceOccurrence[];
  recurrenceCancelled?: boolean;
  recurrenceCreated?: boolean;
  recurrenceLoaded?: boolean;
  recurrencePreview?: boolean;
  recurrenceSplit?: boolean;
  recurrenceUpdated?: boolean;
  rule?: AgendaRecurrenceRule | null;
  scope?: AgendaRecurrenceOperationScope | string | null;
  series?: AgendaRecurrenceRule | null;
  split?: Record<string, unknown> | null;
  truncated?: boolean;
};

export type AgendaRecurrenceMutationPayload = Partial<AgendaRecurrenceRule> & {
  limit?: number;
  notificationChannels?: Array<"EMAIL" | "IN_APP" | "PUSH" | "WHATSAPP" | string>;
  notificationEventType?: string | null;
  notificationIdempotencyKey?: string | null;
  notificationMessage?: string | null;
  notificationRecipients?: AgendaNotificationRecipient[];
  notificationTitle?: string | null;
  notificationType?: string | null;
  occurrenceDate?: string | null;
  occurrenceKey?: string | null;
  occurrenceStartTime?: string | null;
  reason?: string | null;
  requestedBy?: string | null;
  scope?: AgendaRecurrenceOperationScope | string | null;
  seriesId?: string | null;
  skipConflictValidation?: boolean;
};
