import { api } from "@/lib/api";

import type {
  ChampionshipAvailableTeamFilters,
  Championship,
  ChampionshipBracket,
  ChampionshipBracketFilters,
  ChampionshipBracketMatch,
  ChampionshipBracketMatchAdvancePayload,
  ChampionshipBracketMatchUpdatePayload,
  ChampionshipFilters,
  ChampionshipGenerateBracketPayload,
  ChampionshipGenerateMatchesPayload,
  ChampionshipGenerateMatchesResponse,
  ChampionshipGroup,
  ChampionshipGroupAssignmentPayload,
  ChampionshipGroupDrawPayload,
  ChampionshipGroupFilters,
  ChampionshipGroupMovePayload,
  ChampionshipGroupPayload,
  ChampionshipGroupUpdatePayload,
  ChampionshipListResponse,
  ChampionshipMatch,
  ChampionshipMatchFilters,
  ChampionshipMatchEventPayload,
  ChampionshipMatchEventUpdatePayload,
  ChampionshipMatchMovePayload,
  ChampionshipMatchPayload,
  ChampionshipMatchReport,
  ChampionshipMatchReportFinalizePayload,
  ChampionshipMatchReportLookup,
  ChampionshipMatchReportPayload,
  ChampionshipMatchUpdatePayload,
  ChampionshipMutationPayload,
  ChampionshipPaginatedResponse,
  ChampionshipRegistration,
  ChampionshipRegistrationFilters,
  ChampionshipRegistrationPayload,
  ChampionshipRegistrationPlayer,
  ChampionshipRegistrationPlayerFilters,
  ChampionshipRegistrationPlayerPayload,
  ChampionshipRegistrationPlayerUpdatePayload,
  ChampionshipRegistrationUpdatePayload,
  ChampionshipRound,
  ChampionshipRoundFilters,
  ChampionshipRoundPayload,
  ChampionshipRoundUpdatePayload,
  ChampionshipStandingFilters,
  ChampionshipStandingRecalculatePayload,
  ChampionshipStandingResponse,
  ChampionshipRankingFilters,
  ChampionshipRankingsResponse,
  ChampionshipStatisticsFilters,
  ChampionshipStatisticsRecalculatePayload,
  ChampionshipStatisticsResponse,
  ChampionshipTeam,
  ChampionshipTopScorersResponse,
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

function withRegistrationPlayerQuery(
  endpoint: string,
  params?: ChampionshipRegistrationPlayerFilters,
) {
  const search = new URLSearchParams();

  if (params?.search?.trim()) search.set("search", params.search.trim());
  if (params?.position?.trim()) search.set("position", params.position.trim());
  if (params?.status) search.set("status", params.status);
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDirection) search.set("sortDirection", params.sortDirection);
  if (params?.page && params.page > 0) search.set("page", String(Math.trunc(params.page)));
  if (params?.limit && params.limit > 0) search.set("limit", String(Math.trunc(params.limit)));

  return search.size > 0 ? `${endpoint}?${search.toString()}` : endpoint;
}

function withGroupQuery(endpoint: string, params?: ChampionshipGroupFilters) {
  const search = new URLSearchParams();

  if (params?.search?.trim()) search.set("search", params.search.trim());
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDirection) search.set("sortDirection", params.sortDirection);
  if (params?.page && params.page > 0) search.set("page", String(Math.trunc(params.page)));
  if (params?.limit && params.limit > 0) search.set("limit", String(Math.trunc(params.limit)));

  return search.size > 0 ? `${endpoint}?${search.toString()}` : endpoint;
}

function withRoundQuery(endpoint: string, params?: ChampionshipRoundFilters) {
  const search = new URLSearchParams();

  if (params?.search?.trim()) search.set("search", params.search.trim());
  if (params?.phase) search.set("phase", params.phase);
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDirection) search.set("sortDirection", params.sortDirection);
  if (params?.page && params.page > 0) search.set("page", String(Math.trunc(params.page)));
  if (params?.limit && params.limit > 0) search.set("limit", String(Math.trunc(params.limit)));

  return search.size > 0 ? `${endpoint}?${search.toString()}` : endpoint;
}

function withMatchQuery(endpoint: string, params?: ChampionshipMatchFilters) {
  const search = new URLSearchParams();

  if (params?.groupId?.trim()) search.set("groupId", params.groupId.trim());
  if (params?.roundId?.trim()) search.set("roundId", params.roundId.trim());
  if (params?.search?.trim()) search.set("search", params.search.trim());
  if (params?.phase) search.set("phase", params.phase);
  if (params?.status) search.set("status", params.status);
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDirection) search.set("sortDirection", params.sortDirection);
  if (params?.page && params.page > 0) search.set("page", String(Math.trunc(params.page)));
  if (params?.limit && params.limit > 0) search.set("limit", String(Math.trunc(params.limit)));

  return search.size > 0 ? `${endpoint}?${search.toString()}` : endpoint;
}

function withStandingQuery(endpoint: string, params?: ChampionshipStandingFilters) {
  const search = new URLSearchParams();

  if (params?.criteria?.length) search.set("criteria", params.criteria.join(","));
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDirection) search.set("sortDirection", params.sortDirection);
  if (params?.page && params.page > 0) search.set("page", String(Math.trunc(params.page)));
  if (params?.limit && params.limit > 0) search.set("limit", String(Math.trunc(params.limit)));

  return search.size > 0 ? `${endpoint}?${search.toString()}` : endpoint;
}

function withStatisticsQuery(
  endpoint: string,
  params?: ChampionshipStatisticsFilters | ChampionshipRankingFilters,
) {
  const search = new URLSearchParams();
  const rankingFilters = params && "type" in params ? params : undefined;

  if (rankingFilters?.type) search.set("type", rankingFilters.type);
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

export function listChampionshipRegistrationPlayers(
  registrationId: string,
  filters?: ChampionshipRegistrationPlayerFilters,
) {
  return api.get<ChampionshipPaginatedResponse<ChampionshipRegistrationPlayer>>(
    withRegistrationPlayerQuery(
      `${CHAMPIONSHIP_ENDPOINT}/inscricoes/${encodePath(registrationId)}/atletas`,
      filters,
    ),
  );
}

export function getChampionshipRegistrationPlayer(input: {
  playerId: string;
  registrationId: string;
}) {
  return api.get<ChampionshipRegistrationPlayer>(
    `${CHAMPIONSHIP_ENDPOINT}/inscricoes/${encodePath(input.registrationId)}/atletas/${encodePath(
      input.playerId,
    )}`,
  );
}

export function createRegistrationPlayer(input: {
  payload: ChampionshipRegistrationPlayerPayload;
  registrationId: string;
}) {
  return api.post<ChampionshipRegistrationPlayer>(
    `${CHAMPIONSHIP_ENDPOINT}/inscricoes/${encodePath(input.registrationId)}/atletas`,
    input.payload,
  );
}

export function updateRegistrationPlayer(input: {
  payload: ChampionshipRegistrationPlayerUpdatePayload;
  playerId: string;
  registrationId: string;
}) {
  return api.patch<ChampionshipRegistrationPlayer>(
    `${CHAMPIONSHIP_ENDPOINT}/inscricoes/${encodePath(input.registrationId)}/atletas/${encodePath(
      input.playerId,
    )}`,
    input.payload,
  );
}

export function deleteRegistrationPlayer(input: { playerId: string; registrationId: string }) {
  return api.delete<ChampionshipRegistrationPlayer>(
    `${CHAMPIONSHIP_ENDPOINT}/inscricoes/${encodePath(input.registrationId)}/atletas/${encodePath(
      input.playerId,
    )}`,
  );
}

export function setRegistrationPlayerCaptain(input: {
  captain?: boolean;
  playerId: string;
  registrationId: string;
}) {
  return api.patch<ChampionshipRegistrationPlayer>(
    `${CHAMPIONSHIP_ENDPOINT}/inscricoes/${encodePath(input.registrationId)}/atletas/${encodePath(
      input.playerId,
    )}/capitao`,
    { captain: input.captain ?? true },
  );
}

export function listChampionshipGroups(championshipId: string, filters?: ChampionshipGroupFilters) {
  return api.get<ChampionshipPaginatedResponse<ChampionshipGroup>>(
    withGroupQuery(`${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/grupos`, filters),
  );
}

export function getChampionshipGroup(input: { championshipId: string; groupId: string }) {
  return api.get<ChampionshipGroup>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/grupos/${encodePath(
      input.groupId,
    )}`,
  );
}

export function createChampionshipGroup(input: {
  championshipId: string;
  payload: ChampionshipGroupPayload;
}) {
  return api.post<ChampionshipGroup>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/grupos`,
    input.payload,
  );
}

export function updateChampionshipGroup(input: {
  championshipId: string;
  groupId: string;
  payload: ChampionshipGroupUpdatePayload;
}) {
  return api.patch<ChampionshipGroup>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/grupos/${encodePath(
      input.groupId,
    )}`,
    input.payload,
  );
}

export function deleteChampionshipGroup(input: { championshipId: string; groupId: string }) {
  return api.delete<ChampionshipGroup>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/grupos/${encodePath(
      input.groupId,
    )}`,
  );
}

export function assignRegistrationToGroup(input: {
  championshipId: string;
  groupId: string;
  payload: ChampionshipGroupAssignmentPayload;
}) {
  return api.post<ChampionshipGroup>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/grupos/${encodePath(
      input.groupId,
    )}/inscricoes`,
    input.payload,
  );
}

export function removeRegistrationFromGroup(input: {
  championshipId: string;
  groupId: string;
  registrationId: string;
}) {
  return api.delete<ChampionshipGroup>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/grupos/${encodePath(
      input.groupId,
    )}/inscricoes/${encodePath(input.registrationId)}`,
  );
}

export function moveRegistrationBetweenGroups(input: {
  championshipId: string;
  groupId: string;
  payload: ChampionshipGroupMovePayload;
  registrationId: string;
}) {
  return api.patch<ChampionshipGroup>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/grupos/${encodePath(
      input.groupId,
    )}/inscricoes/${encodePath(input.registrationId)}/mover`,
    input.payload,
  );
}

export function drawChampionshipGroups(input: {
  championshipId: string;
  payload: ChampionshipGroupDrawPayload;
}) {
  return api.post<ChampionshipPaginatedResponse<ChampionshipGroup>>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/grupos/sortear`,
    input.payload,
  );
}

export function redistributeChampionshipGroups(input: {
  championshipId: string;
  payload: ChampionshipGroupDrawPayload;
}) {
  return api.post<ChampionshipPaginatedResponse<ChampionshipGroup>>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/grupos/redistribuir`,
    input.payload,
  );
}

export function listChampionshipRounds(championshipId: string, filters?: ChampionshipRoundFilters) {
  return api.get<ChampionshipPaginatedResponse<ChampionshipRound>>(
    withRoundQuery(`${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/rodadas`, filters),
  );
}

export function getChampionshipRound(input: { championshipId: string; roundId: string }) {
  return api.get<ChampionshipRound>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/rodadas/${encodePath(
      input.roundId,
    )}`,
  );
}

export function createChampionshipRound(input: {
  championshipId: string;
  payload: ChampionshipRoundPayload;
}) {
  return api.post<ChampionshipRound>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/rodadas`,
    input.payload,
  );
}

export function updateChampionshipRound(input: {
  championshipId: string;
  payload: ChampionshipRoundUpdatePayload;
  roundId: string;
}) {
  return api.patch<ChampionshipRound>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/rodadas/${encodePath(
      input.roundId,
    )}`,
    input.payload,
  );
}

export function deleteChampionshipRound(input: { championshipId: string; roundId: string }) {
  return api.delete<ChampionshipRound>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/rodadas/${encodePath(
      input.roundId,
    )}`,
  );
}

export function listChampionshipMatches(
  championshipId: string,
  filters?: ChampionshipMatchFilters,
) {
  return api.get<ChampionshipPaginatedResponse<ChampionshipMatch>>(
    withMatchQuery(`${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/jogos`, filters),
  );
}

export function createChampionshipMatch(input: {
  championshipId: string;
  payload: ChampionshipMatchPayload;
  roundId: string;
}) {
  return api.post<ChampionshipMatch>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/rodadas/${encodePath(
      input.roundId,
    )}/jogos`,
    input.payload,
  );
}

export function updateChampionshipMatch(input: {
  championshipId: string;
  matchId: string;
  payload: ChampionshipMatchUpdatePayload;
}) {
  return api.patch<ChampionshipMatch>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/jogos/${encodePath(
      input.matchId,
    )}`,
    input.payload,
  );
}

export function deleteChampionshipMatch(input: { championshipId: string; matchId: string }) {
  return api.delete<ChampionshipMatch>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/jogos/${encodePath(
      input.matchId,
    )}`,
  );
}

export function moveChampionshipMatch(input: {
  championshipId: string;
  matchId: string;
  payload: ChampionshipMatchMovePayload;
}) {
  return api.patch<ChampionshipMatch>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/jogos/${encodePath(
      input.matchId,
    )}/mover`,
    input.payload,
  );
}

export function generateChampionshipMatches(input: {
  championshipId: string;
  payload: ChampionshipGenerateMatchesPayload;
}) {
  return api.post<ChampionshipGenerateMatchesResponse>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/rodadas/gerar-jogos`,
    input.payload,
  );
}

export function getMatchReport(matchId: string) {
  return api.get<ChampionshipMatchReportLookup>(
    `${CHAMPIONSHIP_ENDPOINT}/jogos/${encodePath(matchId)}/sumula`,
  );
}

export function createMatchReport(input: {
  matchId: string;
  payload?: ChampionshipMatchReportPayload;
}) {
  return api.post<ChampionshipMatchReport>(
    `${CHAMPIONSHIP_ENDPOINT}/jogos/${encodePath(input.matchId)}/sumula`,
    input.payload || {},
  );
}

export function updateMatchReport(input: {
  matchId: string;
  payload: ChampionshipMatchReportPayload;
}) {
  return api.patch<ChampionshipMatchReport>(
    `${CHAMPIONSHIP_ENDPOINT}/jogos/${encodePath(input.matchId)}/sumula`,
    input.payload,
  );
}

export function openMatchReport(matchId: string) {
  return api.post<ChampionshipMatchReport>(
    `${CHAMPIONSHIP_ENDPOINT}/jogos/${encodePath(matchId)}/sumula/abrir`,
  );
}

export function createMatchReportEvent(input: {
  matchId: string;
  payload: ChampionshipMatchEventPayload;
}) {
  return api.post<ChampionshipMatchReport>(
    `${CHAMPIONSHIP_ENDPOINT}/jogos/${encodePath(input.matchId)}/sumula/eventos`,
    input.payload,
  );
}

export function updateMatchReportEvent(input: {
  eventId: string;
  matchId: string;
  payload: ChampionshipMatchEventUpdatePayload;
}) {
  return api.patch<ChampionshipMatchReport>(
    `${CHAMPIONSHIP_ENDPOINT}/jogos/${encodePath(input.matchId)}/sumula/eventos/${encodePath(
      input.eventId,
    )}`,
    input.payload,
  );
}

export function deleteMatchReportEvent(input: { eventId: string; matchId: string }) {
  return api.delete<ChampionshipMatchReport>(
    `${CHAMPIONSHIP_ENDPOINT}/jogos/${encodePath(input.matchId)}/sumula/eventos/${encodePath(
      input.eventId,
    )}`,
  );
}

export function finalizeMatchReport(input: {
  matchId: string;
  payload?: ChampionshipMatchReportFinalizePayload;
}) {
  return api.post<ChampionshipMatchReport>(
    `${CHAMPIONSHIP_ENDPOINT}/jogos/${encodePath(input.matchId)}/sumula/finalizar`,
    input.payload || {},
  );
}

export function reopenMatchReport(matchId: string) {
  return api.post<ChampionshipMatchReport>(
    `${CHAMPIONSHIP_ENDPOINT}/jogos/${encodePath(matchId)}/sumula/reabrir`,
  );
}

export function listChampionshipStandings(
  championshipId: string,
  filters?: ChampionshipStandingFilters,
) {
  const baseEndpoint = filters?.groupId?.trim()
    ? `${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/grupos/${encodePath(
        filters.groupId,
      )}/classificacao`
    : `${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/classificacao`;

  return api.get<ChampionshipStandingResponse>(withStandingQuery(baseEndpoint, filters));
}

export function recalculateChampionshipStandings(input: {
  championshipId: string;
  payload?: ChampionshipStandingRecalculatePayload;
}) {
  return api.post<ChampionshipStandingResponse>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/classificacao/recalcular`,
    input.payload || {},
  );
}

export function getChampionshipStatistics(
  championshipId: string,
  filters?: ChampionshipStatisticsFilters,
) {
  return api.get<ChampionshipStatisticsResponse>(
    withStatisticsQuery(
      `${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/estatisticas`,
      filters,
    ),
  );
}

export function getChampionshipRankings(
  championshipId: string,
  filters?: ChampionshipRankingFilters,
) {
  return api.get<ChampionshipRankingsResponse>(
    withStatisticsQuery(`${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/rankings`, filters),
  );
}

export function getChampionshipTopScorers(
  championshipId: string,
  filters?: ChampionshipStatisticsFilters,
) {
  return api.get<ChampionshipTopScorersResponse>(
    withStatisticsQuery(
      `${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/artilharia`,
      filters,
    ),
  );
}

export function recalculateChampionshipStatistics(input: {
  championshipId: string;
  payload?: ChampionshipStatisticsRecalculatePayload;
}) {
  return api.post<ChampionshipStatisticsResponse>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/estatisticas/recalcular`,
    input.payload || {},
  );
}

export function getChampionshipBracket(
  championshipId: string,
  filters?: ChampionshipBracketFilters,
) {
  const phase = filters?.phase;
  const endpoint = phase
    ? `${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/playoffs/${encodePath(phase)}`
    : `${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/playoffs`;

  return api.get<ChampionshipBracket | null>(endpoint);
}

export function generateChampionshipBracket(input: {
  championshipId: string;
  payload: ChampionshipGenerateBracketPayload;
}) {
  return api.post<ChampionshipBracket>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(input.championshipId)}/playoffs/gerar`,
    input.payload,
  );
}

export function updateChampionshipBracketMatch(input: {
  matchId: string;
  payload: ChampionshipBracketMatchUpdatePayload;
}) {
  return api.patch<ChampionshipBracketMatch>(
    `${CHAMPIONSHIP_ENDPOINT}/playoffs/matches/${encodePath(input.matchId)}`,
    input.payload,
  );
}

export function advanceChampionshipBracketMatch(input: {
  matchId: string;
  payload?: ChampionshipBracketMatchAdvancePayload;
}) {
  return api.post<ChampionshipBracketMatch>(
    `${CHAMPIONSHIP_ENDPOINT}/playoffs/matches/${encodePath(input.matchId)}/avancar`,
    input.payload || {},
  );
}

export function deleteChampionshipBracket(championshipId: string) {
  return api.delete<ChampionshipBracket>(
    `${CHAMPIONSHIP_ENDPOINT}/${encodePath(championshipId)}/playoffs`,
  );
}
