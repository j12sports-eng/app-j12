export type CourtStatus = "ativa" | "manutencao" | "indisponivel";
export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "completed" | "waitlisted";
export type PaymentStatus = "pending" | "paid" | "cancelled" | "refunded";
export type PaymentMethod =
  | "pix"
  | "boleto"
  | "cartao"
  | "dinheiro"
  | "cortesia"
  | "mensalista"
  | "avulso";
export type CalendarView = "day" | "week" | "month";
export type WeekdayKey = "dom" | "seg" | "ter" | "qua" | "qui" | "sex" | "sab";

export type TimeWindow = {
  start: string;
  end: string;
};

export type CourtOpeningHours = Record<WeekdayKey, TimeWindow[]>;

export type CourtDimensions = {
  comprimento: number;
  largura: number;
  unidade: string;
};

export type Court = {
  capacidade: number;
  coberta: boolean;
  createdAt?: string | null;
  descricao: string;
  dimensoes: CourtDimensions;
  fotos: string[];
  funcionamento: CourtOpeningHours;
  id: string;
  iluminacao: boolean;
  nome: string;
  observacoes: string;
  precoBase: number;
  precoFimSemana: number;
  precoNoturno: number;
  status: CourtStatus;
  tempoMaximoMinutos: number;
  tempoMinimoMinutos: number;
  tipo: string;
  unidade: string;
  updatedAt?: string | null;
};

export type CourtMutationPayload = {
  capacidade?: number;
  coberta?: boolean;
  descricao?: string;
  dimensoes?: CourtDimensions;
  fotos?: string[];
  funcionamento?: CourtOpeningHours;
  iluminacao?: boolean;
  nome: string;
  observacoes?: string;
  precoBase?: number;
  precoFimSemana?: number;
  precoNoturno?: number;
  status?: CourtStatus;
  tempoMaximoMinutos?: number;
  tempoMinimoMinutos?: number;
  tipo?: string;
  unidade?: string;
};

export type Renter = {
  createdAt?: string | null;
  documento: string;
  email: string;
  id: string;
  nome: string;
  observacoes: string;
  status: "ativo" | "inativo";
  telefone: string;
  updatedAt?: string | null;
};

export type RenterMutationPayload = {
  documento?: string;
  email?: string;
  nome: string;
  observacoes?: string;
  telefone?: string;
};

export type PriceRule = {
  active: boolean;
  courtId: string;
  currency: string;
  endTime: string | null;
  id: string;
  pricePerHour: number;
  priority: number;
  startTime: string | null;
  weekday: WeekdayKey | null;
};

export type PriceRulePayload = {
  active?: boolean;
  currency?: string;
  diaSemana?: WeekdayKey | "";
  horarioFim?: string;
  horarioInicio?: string;
  id?: string;
  prioridade?: number;
  valorHora: number;
};

export type ReservationRenter = {
  email: string;
  id: string;
  nome: string;
  telefone: string;
};

export type ReservationCourt = {
  id: string;
  nome: string;
  tipo: string;
};

export type ReservationRecurrencePayload = {
  daysOfWeek?: WeekdayKey[];
  frequency: "weekly" | "monthly";
  interval?: number;
  until?: string;
};

export type Reservation = {
  cancelReason: string;
  cancelledAt: string | null;
  couponCode: string;
  court: ReservationCourt;
  createdAt?: string | null;
  discountValue: number;
  durationMinutes: number;
  endAt: string;
  finalValue: number;
  financialChargeId: string | null;
  id: string;
  notes: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  recurrence: ReservationRecurrencePayload | null;
  recurrenceGroupId: string | null;
  renter: ReservationRenter;
  reservationType: "avulsa" | "recorrente";
  startAt: string;
  status: ReservationStatus;
  title: string;
  updatedAt?: string | null;
  value: number;
  waitlistPromotion?: {
    error?: string;
    reservation?: Reservation;
    waitlist?: WaitlistEntry;
    waitlistId?: string;
  } | null;
};

export type ReservationPayload = {
  allowWaitlist?: boolean;
  autoConfirm?: boolean;
  courtId: string;
  couponCode?: string;
  discountValue?: number;
  endAt: string;
  generateCharge?: boolean;
  notes?: string;
  paymentMethod?: PaymentMethod;
  recurrence?: ReservationRecurrencePayload | null;
  renter?: RenterMutationPayload | null;
  renterId?: string;
  startAt: string;
  title?: string;
};

export type ReservationMutationResponse = {
  created: Reservation[];
  summary: {
    createdCount: number;
    waitlistedCount: number;
  };
  waitlisted: WaitlistEntry[];
};

export type AvailabilityConflict = {
  endAt: string;
  id: string;
  reason?: string;
  source: "reservation" | "block";
  startAt: string;
  status?: string;
  type?: string;
};

export type AvailabilityValidation = {
  available: boolean;
  code: string;
  conflicts?: AvailabilityConflict[];
  reason: string | null;
};

export type CourtBlock = {
  active: boolean;
  court: {
    id: string;
    nome: string;
  };
  endAt: string;
  exclusiveForClasses: boolean;
  id: string;
  reason: string;
  recurrence: ReservationRecurrencePayload | null;
  startAt: string;
  type:
    | "administrativo"
    | "feriado"
    | "manutencao"
    | "aula"
    | "indisponivel"
    | "evento"
    | "campeonato"
    | "uso_interno";
};

export type CourtBlockPayload = {
  courtId: string;
  endAt: string;
  exclusiveForClasses?: boolean;
  reason?: string;
  startAt: string;
  type?: CourtBlock["type"];
};

export type AvailabilitySlot = {
  blocks: CourtBlock[];
  courtId: string;
  courtName: string;
  date: string;
  reservations: Reservation[];
  status: CourtStatus;
  windows: TimeWindow[];
};

export type AvailabilityResponse = {
  blocks: CourtBlock[];
  courts: Court[];
  period: {
    endAt: string;
    startAt: string;
    view: CalendarView | "custom";
  };
  reservations: Reservation[];
  slots: AvailabilitySlot[];
};

export type WaitlistEntry = {
  court: {
    id: string;
    nome: string;
  };
  createdAt?: string;
  desiredEndAt: string;
  desiredStartAt: string;
  id: string;
  reason: string;
  renter: {
    id: string;
    nome: string;
  };
  status: string;
};

export type WaitlistPayload = {
  courtId: string;
  desiredEndAt: string;
  desiredStartAt: string;
  reason?: string;
  renterId: string;
};

export type CourtReports = {
  cancelledReservations: number;
  frequentRenters: Array<{
    renterId: string;
    renterName: string;
    reservations: number;
    revenue: number;
  }>;
  mostUsedHours: Array<{
    hour: string;
    reservations: number;
  }>;
  occupancyRate: number;
  period: {
    from: string;
    to: string;
  };
  reservationCount: number;
  revenueByCourt: Array<{
    courtId: string;
    courtName: string;
    reservations: number;
    revenue: number;
  }>;
  totalRevenue: number;
};

export type CourtReportExport = {
  contentBase64: string;
  filename: string;
  format: "csv" | "excel" | "pdf";
  mimeType: string;
};

export type AuditEntry = {
  action: string;
  actorId: string;
  actorRole: string;
  createdAt: string;
  entityId: string;
  id: string;
  metadata: Record<string, unknown>;
};

export type ReservationFilters = {
  courtId?: string;
  from?: string;
  limit?: number;
  renterId?: string;
  status?: ReservationStatus | "";
  to?: string;
};

export type AvailabilityFilters = {
  courtId?: string;
  date?: string;
  from?: string;
  to?: string;
  view?: CalendarView;
};
