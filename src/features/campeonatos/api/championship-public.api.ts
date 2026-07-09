import { api } from "@/lib/api";

import type {
  PublicBracket,
  PublicChampionship,
  PublicChampionshipListFilters,
  PublicGroup,
  PublicMatch,
  PublicPaginatedResponse,
  PublicPaginationFilters,
  PublicStandingResponse,
  PublicStatisticsResponse,
  PublicTeam,
  PublicTopScorersResponse,
} from "../types/championship-public.types";

const PUBLIC_CHAMPIONSHIP_ENDPOINT = "/public/campeonatos";
const PUBLIC_API_OPTIONS = {
  skipAuthHeader: true,
  skipAuthRedirect: true,
};

type QueryValue = number | string | null | undefined;

function withPublicQuery(
  endpoint: string,
  params?: PublicChampionshipListFilters | PublicPaginationFilters,
) {
  const search = new URLSearchParams();

  appendQueryValue(search, "category", "category" in (params || {}) ? params?.category : undefined);
  appendQueryValue(search, "limit", params?.limit);
  appendQueryValue(
    search,
    "modality",
    "modality" in (params || {}) ? params?.modality : undefined,
  );
  appendQueryValue(search, "page", params?.page);
  appendQueryValue(search, "search", "search" in (params || {}) ? params?.search : undefined);
  appendQueryValue(search, "sortBy", "sortBy" in (params || {}) ? params?.sortBy : undefined);
  appendQueryValue(
    search,
    "sortDirection",
    "sortDirection" in (params || {}) ? params?.sortDirection : undefined,
  );

  return search.size > 0 ? `${endpoint}?${search.toString()}` : endpoint;
}

function appendQueryValue(search: URLSearchParams, key: string, value: QueryValue) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    search.set(key, String(Math.trunc(value)));
    return;
  }

  if (typeof value === "string" && value.trim()) {
    search.set(key, value.trim());
  }
}

function encodePath(value: string) {
  return encodeURIComponent(value.trim());
}

export function listPublicChampionships(filters?: PublicChampionshipListFilters) {
  return api.get<PublicPaginatedResponse<PublicChampionship>>(
    withPublicQuery(PUBLIC_CHAMPIONSHIP_ENDPOINT, filters),
    PUBLIC_API_OPTIONS,
  );
}

export function getPublicChampionship(championshipId: string) {
  return api.get<PublicChampionship>(
    `${PUBLIC_CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}`,
    PUBLIC_API_OPTIONS,
  );
}

export function listPublicChampionshipGroups(
  championshipId: string,
  filters?: PublicPaginationFilters,
) {
  return api.get<PublicPaginatedResponse<PublicGroup>>(
    withPublicQuery(
      `${PUBLIC_CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/grupos`,
      filters,
    ),
    PUBLIC_API_OPTIONS,
  );
}

export function listPublicChampionshipTeams(
  championshipId: string,
  filters?: PublicPaginationFilters,
) {
  return api.get<PublicPaginatedResponse<PublicTeam>>(
    withPublicQuery(
      `${PUBLIC_CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/equipes`,
      filters,
    ),
    PUBLIC_API_OPTIONS,
  );
}

export function listPublicChampionshipMatches(
  championshipId: string,
  filters?: PublicPaginationFilters,
) {
  return api.get<PublicPaginatedResponse<PublicMatch>>(
    withPublicQuery(`${PUBLIC_CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/jogos`, filters),
    PUBLIC_API_OPTIONS,
  );
}

export function getPublicChampionshipStandings(
  championshipId: string,
  filters?: PublicPaginationFilters,
) {
  return api.get<PublicStandingResponse>(
    withPublicQuery(
      `${PUBLIC_CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/classificacao`,
      filters,
    ),
    PUBLIC_API_OPTIONS,
  );
}

export function getPublicChampionshipBracket(championshipId: string) {
  return api.get<PublicBracket>(
    `${PUBLIC_CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/mata-mata`,
    PUBLIC_API_OPTIONS,
  );
}

export function getPublicChampionshipStatistics(
  championshipId: string,
  filters?: PublicPaginationFilters,
) {
  return api.get<PublicStatisticsResponse>(
    withPublicQuery(
      `${PUBLIC_CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/estatisticas`,
      filters,
    ),
    PUBLIC_API_OPTIONS,
  );
}

export function getPublicChampionshipTopScorers(
  championshipId: string,
  filters?: PublicPaginationFilters,
) {
  return api.get<PublicTopScorersResponse>(
    withPublicQuery(
      `${PUBLIC_CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/artilharia`,
      filters,
    ),
    PUBLIC_API_OPTIONS,
  );
}
