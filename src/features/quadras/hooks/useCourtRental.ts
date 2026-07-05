import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addToWaitlist,
  createBlock,
  createCourt,
  createRenter,
  createReservation,
  cancelBlock,
  listAudit,
  listBlocks,
  listCourts,
  listPriceRules,
  listRenters,
  listReports,
  listReservations,
  listWaitlist,
  getAvailability,
  updateCourt,
  updateReservation,
  upsertPriceRule,
  cancelReservation,
  confirmReservationPayment,
  duplicateReservation,
  exportReports,
  promoteWaitlistEntry,
  rescheduleReservation,
  validateAvailability,
  updateBlock,
} from "../api/court-rental.api";

import type {
  AvailabilityFilters,
  CourtBlockPayload,
  CourtMutationPayload,
  PriceRulePayload,
  RenterMutationPayload,
  ReservationFilters,
  ReservationPayload,
  WaitlistPayload,
} from "../types/quadras.types";

export const courtRentalQueryKeys = {
  all: ["quadras", "locacao"] as const,
  audit: (limit?: number) => [...courtRentalQueryKeys.all, "auditoria", limit || ""] as const,
  availability: (filters?: AvailabilityFilters) =>
    [...courtRentalQueryKeys.all, "disponibilidade", filters || {}] as const,
  blocks: (filters?: AvailabilityFilters) =>
    [...courtRentalQueryKeys.all, "bloqueios", filters || {}] as const,
  courts: (filters?: { status?: string }) =>
    [...courtRentalQueryKeys.all, "quadras", filters || {}] as const,
  priceRules: (courtId?: string) => [...courtRentalQueryKeys.all, "precos", courtId || ""] as const,
  renters: (search?: string) => [...courtRentalQueryKeys.all, "locatarios", search || ""] as const,
  reports: (filters?: AvailabilityFilters) =>
    [...courtRentalQueryKeys.all, "relatorios", filters || {}] as const,
  reservations: (filters?: ReservationFilters) =>
    [...courtRentalQueryKeys.all, "reservas", filters || {}] as const,
  waitlist: (courtId?: string) =>
    [...courtRentalQueryKeys.all, "lista-espera", courtId || ""] as const,
};

const STALE_TIME_MS = 30_000;
const GC_TIME_MS = 5 * 60_000;

export function useCourts(filters?: { status?: string }) {
  return useQuery({
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listCourts(filters),
    queryKey: courtRentalQueryKeys.courts(filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useCourtPriceRules(courtId?: string) {
  return useQuery({
    enabled: Boolean(courtId),
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listPriceRules(courtId || ""),
    queryKey: courtRentalQueryKeys.priceRules(courtId),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useRenters(search?: string) {
  return useQuery({
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listRenters({ search }),
    queryKey: courtRentalQueryKeys.renters(search),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useReservations(filters?: ReservationFilters) {
  return useQuery({
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listReservations(filters),
    queryKey: courtRentalQueryKeys.reservations(filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useCourtAvailability(filters?: AvailabilityFilters) {
  return useQuery({
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => getAvailability(filters),
    queryKey: courtRentalQueryKeys.availability(filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useCourtBlocks(filters?: AvailabilityFilters) {
  return useQuery({
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listBlocks(filters),
    queryKey: courtRentalQueryKeys.blocks(filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useCourtWaitlist(courtId?: string) {
  return useQuery({
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listWaitlist({ courtId }),
    queryKey: courtRentalQueryKeys.waitlist(courtId),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useCourtReports(filters?: AvailabilityFilters) {
  return useQuery({
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listReports(filters),
    queryKey: courtRentalQueryKeys.reports(filters),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useCourtAudit(limit = 80) {
  return useQuery({
    gcTime: GC_TIME_MS,
    placeholderData: keepPreviousData,
    queryFn: () => listAudit({ limit }),
    queryKey: courtRentalQueryKeys.audit(limit),
    retry: 1,
    staleTime: STALE_TIME_MS,
  });
}

export function useCourtRentalActions() {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateCourtRentalQueries(queryClient);

  return {
    addToWaitlist: useMutation({
      mutationFn: (payload: WaitlistPayload) => addToWaitlist(payload),
      onSuccess: invalidate,
    }),
    cancelReservation: useMutation({
      mutationFn: cancelReservation,
      onSuccess: invalidate,
    }),
    cancelBlock: useMutation({
      mutationFn: cancelBlock,
      onSuccess: invalidate,
    }),
    confirmReservationPayment: useMutation({
      mutationFn: confirmReservationPayment,
      onSuccess: invalidate,
    }),
    createBlock: useMutation({
      mutationFn: (payload: CourtBlockPayload) => createBlock(payload),
      onSuccess: invalidate,
    }),
    createCourt: useMutation({
      mutationFn: (payload: CourtMutationPayload) => createCourt(payload),
      onSuccess: invalidate,
    }),
    createRenter: useMutation({
      mutationFn: (payload: RenterMutationPayload) => createRenter(payload),
      onSuccess: invalidate,
    }),
    createReservation: useMutation({
      mutationFn: (payload: ReservationPayload) => createReservation(payload),
      onSuccess: invalidate,
    }),
    duplicateReservation: useMutation({
      mutationFn: duplicateReservation,
      onSuccess: invalidate,
    }),
    exportReports: useMutation({
      mutationFn: exportReports,
    }),
    promoteWaitlistEntry: useMutation({
      mutationFn: promoteWaitlistEntry,
      onSuccess: invalidate,
    }),
    rescheduleReservation: useMutation({
      mutationFn: rescheduleReservation,
      onSuccess: invalidate,
    }),
    updateBlock: useMutation({
      mutationFn: updateBlock,
      onSuccess: invalidate,
    }),
    updateCourt: useMutation({
      mutationFn: updateCourt,
      onSuccess: invalidate,
    }),
    updateReservation: useMutation({
      mutationFn: updateReservation,
      onSuccess: invalidate,
    }),
    upsertPriceRule: useMutation({
      mutationFn: (input: { courtId: string; payload: PriceRulePayload }) => upsertPriceRule(input),
      onSuccess: invalidate,
    }),
    validateAvailability: useMutation({
      mutationFn: validateAvailability,
    }),
  };
}

function invalidateCourtRentalQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: courtRentalQueryKeys.all });
}
