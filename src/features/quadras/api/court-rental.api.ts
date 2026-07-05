import { api } from "@/lib/api";

import type {
  AuditEntry,
  AvailabilityFilters,
  AvailabilityResponse,
  AvailabilityValidation,
  Court,
  CourtBlock,
  CourtBlockPayload,
  CourtMutationPayload,
  CourtReportExport,
  CourtReports,
  PriceRule,
  PriceRulePayload,
  Renter,
  RenterMutationPayload,
  Reservation,
  ReservationFilters,
  ReservationMutationResponse,
  ReservationPayload,
  WaitlistEntry,
  WaitlistPayload,
} from "../types/quadras.types";

const COURT_RENTAL_ENDPOINT = "/admin/quadras";

type QueryValue = boolean | number | string | null | undefined;
type QueryParams = Record<string, QueryValue>;

function withQuery(endpoint: string, params?: QueryParams) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params || {})) {
    if (typeof value === "undefined" || value === null || value === "") continue;
    search.set(key, String(value));
  }

  return search.size > 0 ? `${endpoint}?${search.toString()}` : endpoint;
}

function encodePath(value: string) {
  return encodeURIComponent(value.trim());
}

export function listCourts(filters?: { status?: string }) {
  return api.get<Court[]>(withQuery(COURT_RENTAL_ENDPOINT, filters));
}

export function getCourt(courtId: string) {
  return api.get<Court>(`${COURT_RENTAL_ENDPOINT}/${encodePath(courtId)}`);
}

export function createCourt(payload: CourtMutationPayload) {
  return api.post<Court>(COURT_RENTAL_ENDPOINT, payload);
}

export function updateCourt(input: { courtId: string; payload: CourtMutationPayload }) {
  return api.put<Court>(`${COURT_RENTAL_ENDPOINT}/${encodePath(input.courtId)}`, input.payload);
}

export function listPriceRules(courtId: string) {
  return api.get<PriceRule[]>(`${COURT_RENTAL_ENDPOINT}/${encodePath(courtId)}/precos`);
}

export function upsertPriceRule(input: { courtId: string; payload: PriceRulePayload }) {
  return api.post<PriceRule>(
    `${COURT_RENTAL_ENDPOINT}/${encodePath(input.courtId)}/precos`,
    input.payload,
  );
}

export function listRenters(filters?: { search?: string }) {
  return api.get<Renter[]>(withQuery(`${COURT_RENTAL_ENDPOINT}/locatarios`, filters));
}

export function createRenter(payload: RenterMutationPayload) {
  return api.post<Renter>(`${COURT_RENTAL_ENDPOINT}/locatarios`, payload);
}

export function listReservations(filters?: ReservationFilters) {
  return api.get<Reservation[]>(withQuery(`${COURT_RENTAL_ENDPOINT}/reservas`, filters));
}

export function createReservation(payload: ReservationPayload) {
  return api.post<ReservationMutationResponse>(`${COURT_RENTAL_ENDPOINT}/reservas`, payload);
}

export function updateReservation(input: {
  reservationId: string;
  payload: Partial<ReservationPayload> & { paymentStatus?: string; status?: string };
}) {
  return api.patch<Reservation>(
    `${COURT_RENTAL_ENDPOINT}/reservas/${encodePath(input.reservationId)}`,
    input.payload,
  );
}

export function confirmReservationPayment(input: {
  paidAt?: string;
  paymentMethod?: string;
  reservationId: string;
}) {
  return api.patch<Reservation>(
    `${COURT_RENTAL_ENDPOINT}/reservas/${encodePath(input.reservationId)}/pagamento`,
    {
      paidAt: input.paidAt,
      paymentMethod: input.paymentMethod,
    },
  );
}

export function duplicateReservation(input: {
  endAt?: string;
  generateCharge?: boolean;
  paymentMethod?: string;
  reservationId: string;
  startAt?: string;
  title?: string;
}) {
  return api.post<Reservation>(
    `${COURT_RENTAL_ENDPOINT}/reservas/${encodePath(input.reservationId)}/duplicar`,
    {
      endAt: input.endAt,
      generateCharge: input.generateCharge,
      paymentMethod: input.paymentMethod,
      startAt: input.startAt,
      title: input.title,
    },
  );
}

export function cancelReservation(input: { reason?: string; reservationId: string }) {
  return api.delete<Reservation>(
    withQuery(`${COURT_RENTAL_ENDPOINT}/reservas/${encodePath(input.reservationId)}/cancelar`, {
      reason: input.reason,
    }),
  );
}

export function rescheduleReservation(input: {
  endAt: string;
  reservationId: string;
  startAt: string;
}) {
  return api.patch<Reservation>(
    `${COURT_RENTAL_ENDPOINT}/reservas/${encodePath(input.reservationId)}/reagendar`,
    {
      endAt: input.endAt,
      startAt: input.startAt,
    },
  );
}

export function getAvailability(filters?: AvailabilityFilters) {
  return api.get<AvailabilityResponse>(
    withQuery(`${COURT_RENTAL_ENDPOINT}/disponibilidade`, filters),
  );
}

export function validateAvailability(input: {
  courtId: string;
  endAt: string;
  excludeReservationId?: string;
  startAt: string;
}) {
  return api.post<AvailabilityValidation>(
    `${COURT_RENTAL_ENDPOINT}/disponibilidade/validar`,
    input,
  );
}

export function calculateReservationQuote(payload: ReservationPayload) {
  return api.post<{
    currency: string;
    discountValue: number;
    durationMinutes: number;
    pricePerHour: number;
    subtotal: number;
    total: number;
  }>(`${COURT_RENTAL_ENDPOINT}/reservas/cotacao`, payload);
}

export function listBlocks(filters?: AvailabilityFilters) {
  return api.get<CourtBlock[]>(withQuery(`${COURT_RENTAL_ENDPOINT}/bloqueios`, filters));
}

export function createBlock(payload: CourtBlockPayload) {
  return api.post<CourtBlock>(`${COURT_RENTAL_ENDPOINT}/bloqueios`, payload);
}

export function updateBlock(input: { blockId: string; payload: CourtBlockPayload }) {
  return api.patch<CourtBlock>(
    `${COURT_RENTAL_ENDPOINT}/bloqueios/${encodePath(input.blockId)}`,
    input.payload,
  );
}

export function cancelBlock(input: { blockId: string; reason?: string }) {
  return api.delete<CourtBlock>(
    withQuery(`${COURT_RENTAL_ENDPOINT}/bloqueios/${encodePath(input.blockId)}`, {
      reason: input.reason,
    }),
  );
}

export function listWaitlist(filters?: { courtId?: string }) {
  return api.get<WaitlistEntry[]>(withQuery(`${COURT_RENTAL_ENDPOINT}/lista-espera`, filters));
}

export function addToWaitlist(payload: WaitlistPayload) {
  return api.post<WaitlistEntry>(`${COURT_RENTAL_ENDPOINT}/lista-espera`, payload);
}

export function promoteWaitlistEntry(input: { waitlistId: string }) {
  return api.post<{
    reservation: Reservation;
    waitlist: WaitlistEntry;
  }>(`${COURT_RENTAL_ENDPOINT}/lista-espera/${encodePath(input.waitlistId)}/promover`);
}

export function listReports(filters?: AvailabilityFilters) {
  return api.get<CourtReports>(withQuery(`${COURT_RENTAL_ENDPOINT}/relatorios`, filters));
}

export function exportReports(
  filters?: AvailabilityFilters & { format?: "csv" | "excel" | "pdf" },
) {
  return api.get<CourtReportExport>(
    withQuery(`${COURT_RENTAL_ENDPOINT}/relatorios/exportar`, filters),
  );
}

export function listAudit(filters?: { limit?: number }) {
  return api.get<AuditEntry[]>(withQuery(`${COURT_RENTAL_ENDPOINT}/auditoria`, filters));
}
