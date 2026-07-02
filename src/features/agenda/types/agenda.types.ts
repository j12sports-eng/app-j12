export type AgendaLookupMode = "student" | "enrollment" | "class";

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
  dayOfWeek?: string | number | null;
  daysOfWeek?: Array<string | number>;
  endTime?: string | null;
  enrollmentId?: string | null;
  id?: string | null;
  modality?: string | null;
  observations?: string | null;
  persistedAgenda?: boolean;
  present?: boolean | null;
  professorName?: string | null;
  recurrence?: string | null;
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
