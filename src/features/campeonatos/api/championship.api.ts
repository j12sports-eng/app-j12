import { api } from "@/lib/api";

import type {
  ChampionshipAvailableTeamFilters,
  Championship,
  ChampionshipFilters,
  ChampionshipListResponse,
  ChampionshipMutationPayload,
  ChampionshipPaginatedResponse,
  ChampionshipRegistration,
  ChampionshipRegistrationFilters,
  ChampionshipRegistrationPayload,
  ChampionshipRegistrationUpdatePayload,
  ChampionshipTeam,
} from "../types/championship.types";

const CHAMPIONSHIP_ENDPOINT = "/admin/campeonatos";

function withQuery(endpoint: string, params?: ChampionshipFilters) {
  const search = new URLSearchParams();

  if (params?.search?.trim()) search.set("search", params.search.trim());
  if (params?.status) search.set("status", params.status);
  if (params?.limit && params.limit > 0) search.set("limit", String(Math.trunc(params.limit)));

  return search.size > 0 ? `${endpoint}?${search.toString()}` : endpoint;
}

function withRegistrationQuery(endpoint: string, params?: ChampionshipRegistrationFilters) {
  const search = new URLSearchParams();

  if (params?.championshipId?.trim()) search.set("championshipId", params.championshipId.trim());
  if (params?.teamId?.trim()) search.set("teamId", params.teamId.trim());
  if (params?.search?.trim()) search.set("search", params.search.trim());
  if (params?.status) search.set("status", params.status);
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDirection) search.set("sortDirection", params.sortDirection);
  if (params?.page && params.page > 0) search.set("page", String(Math.trunc(params.page)));
  if (params?.limit && params.limit > 0) search.set("limit", String(Math.trunc(params.limit)));

  return search.size > 0 ? `${endpoint}?${search.toString()}` : endpoint;
}

function withAvailableTeamsQuery(endpoint: string, params?: ChampionshipAvailableTeamFilters) {
  const search = new URLSearchParams();

  if (params?.championshipId?.trim()) search.set("championshipId", params.championshipId.trim());
  if (params?.search?.trim()) search.set("search", params.search.trim());
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDirection) search.set("sortDirection", params.sortDirection);
  if (params?.page && params.page > 0) search.set("page", String(Math.trunc(params.page)));
  if (params?.limit && params.limit > 0) search.set("limit", String(Math.trunc(params.limit)));

  return search.size > 0 ? `${endpoint}?${search.toString()}` : endpoint;
}

function encodePath(value: string) {
  return encodeURIComponent(value.trim());
}

export function listChampionships(filters?: ChampionshipFilters) {
  return api.get<ChampionshipListResponse>(withQuery(CHAMPIONSHIP_ENDPOINT, filters));
}

export function getChampionship(championshipId: string) {
  return api.get<Championship>(`${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}`);
}

export function createChampionship(payload: ChampionshipMutationPayload) {
  return api.post<Championship>(CHAMPIONSHIP_ENDPOINT, payload);
}

export function updateChampionship(input: {
  championshipId: string;
  payload: Partial<ChampionshipMutationPayload>;
}) {
  return api.put<Championship>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}`,
    input.payload,
  );
}

export function publishChampionship(championshipId: string) {
  return api.post<Championship>(`${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/publish`);
}

export function archiveChampionship(championshipId: string) {
  return api.post<Championship>(`${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/archive`);
}

export function deleteChampionship(championshipId: string) {
  return api.delete<Championship>(`${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}`);
}

export function listChampionshipRegistrations(filters?: ChampionshipRegistrationFilters) {
  return api.get<ChampionshipPaginatedResponse<ChampionshipRegistration>>(
    withRegistrationQuery(`${CHAMPIONSHIP_ENDPOINT}/inscricoes`, filters),
  );
}

export function getChampionshipRegistration(registrationId: string) {
  return api.get<ChampionshipRegistration>(
    `${CHAMPIONSHIP_ENDPOINT}/inscricoes/${encodePath(registrationId)}`,
  );
}

export function listAvailableChampionshipTeams(filters?: ChampionshipAvailableTeamFilters) {
  return api.get<ChampionshipPaginatedResponse<ChampionshipTeam>>(
    withAvailableTeamsQuery(`${CHAMPIONSHIP_ENDPOINT}/inscricoes/equipes-disponiveis`, filters),
  );
}

export function registerTeam(payload: ChampionshipRegistrationPayload) {
  return api.post<ChampionshipRegistration>(`${CHAMPIONSHIP_ENDPOINT}/inscricoes`, payload);
}

export function cancelRegistration(registrationId: string) {
  return api.post<ChampionshipRegistration>(
    `${CHAMPIONSHIP_ENDPOINT}/inscricoes/${encodePath(registrationId)}/cancelar`,
  );
}

export function updateRegistration(input: {
  payload: ChampionshipRegistrationUpdatePayload;
  registrationId: string;
}) {
  return api.patch<ChampionshipRegistration>(
    `${CHAMPIONSHIP_ENDPOINT}/inscricoes/${encodePath(input.registrationId)}/status`,
    input.payload,
  );
}
