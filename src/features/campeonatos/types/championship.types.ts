export type ChampionshipStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "REMOVED";

export type ChampionshipRegistrationStatus = "PENDING" | "CONFIRMED" | "REFUSED" | "CANCELLED";

export type ChampionshipRegistrationPlayerStatus = "ACTIVE" | "INACTIVE";

export type ChampionshipTeamStatus = "ACTIVE" | "INACTIVE" | "DISQUALIFIED";

export type ChampionshipRoundPhase = "GROUP_STAGE";

export type ChampionshipMatchStatus = "SCHEDULED" | "FINISHED" | "POSTPONED" | "CANCELLED";

export type ChampionshipMatchReportStatus = "DRAFT" | "OPEN" | "FINISHED" | "REOPENED";

export type ChampionshipMatchEventType =
  | "FOUL"
  | "GOAL"
  | "OBSERVATION"
  | "RED_CARD"
  | "SUBSTITUTION"
  | "TECHNICAL_TIMEOUT"
  | "WALKOVER"
  | "YELLOW_CARD";

export type ChampionshipBracketMode = "AUTOMATIC" | "MANUAL";

export type ChampionshipBracketStatus =
  | "DRAFT"
  | "READY"
  | "IN_PROGRESS"
  | "FINISHED"
  | "CANCELLED";

export type ChampionshipBracketPhase =
  | "ROUND_OF_32"
  | "ROUND_OF_16"
  | "QUARTER_FINAL"
  | "SEMI_FINAL"
  | "FINAL"
  | "THIRD_PLACE";

export type ChampionshipBracketSlot = "HOME" | "AWAY";

export type ChampionshipStandingTieBreaker =
  | "points"
  | "wins"
  | "goalDifference"
  | "goalsFor"
  | "goalsAgainst"
  | "draws"
  | "losses"
  | "played"
  | "teamName";

export type ChampionshipRankingType = "topScorers" | "fairPlay" | "bestAttack" | "bestDefense";

export type ChampionshipMediaReference = {
  checksum?: string | null;
  fileId?: string | null;
  id?: string | null;
  mimeType?: string | null;
  originalName?: string | null;
  publicUrl?: string | null;
  sizeBytes?: number | null;
  storageKey?: string | null;
  uploadedAt?: string | null;
  uploadedBy?: string | null;
};

export type ChampionshipLogo = ChampionshipMediaReference;

export type ChampionshipTeamShield = ChampionshipMediaReference;

export type ChampionshipTeamCommissionMember = {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  role?: string | null;
};

export type Championship = {
  archivedAt: string | null;
  category: string;
  createdAt: string | null;
  createdBy: string | null;
  deletedAt: string | null;
  description: string | null;
  endDate: string;
  id: string;
  logo: ChampionshipLogo | null;
  metadata: Record<string, unknown>;
  modality: string;
  name: string;
  publishedAt: string | null;
  startDate: string;
  status: ChampionshipStatus;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ChampionshipTeam = {
  acronym: string | null;
  activatedAt: string | null;
  assistantCoach: string | null;
  category: string;
  championshipId: string | null;
  championshipName: string | null;
  city: string | null;
  coach: string | null;
  createdAt: string | null;
  createdBy: string | null;
  deletedAt: string | null;
  disqualifiedAt: string | null;
  id: string;
  inactivatedAt: string | null;
  logo: ChampionshipTeamShield | null;
  metadata: Record<string, unknown>;
  modality: string | null;
  name: string;
  observations: string | null;
  primaryColor: string | null;
  primaryUniform: string | null;
  responsible: string | null;
  secondaryColor: string | null;
  secondaryUniform: string | null;
  shield: ChampionshipTeamShield | null;
  state: string | null;
  status: ChampionshipTeamStatus;
  technicalCommission: ChampionshipTeamCommissionMember[];
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ChampionshipListResponse = {
  items: Championship[];
  limit: number;
  total: number;
};

export type ChampionshipRegistration = {
  cancelledAt: string | null;
  category: string | null;
  championshipId: string;
  championshipName: string | null;
  confirmedAt: string | null;
  createdAt: string | null;
  createdBy: string | null;
  deletedAt: string | null;
  id: string;
  metadata: Record<string, unknown>;
  modality: string | null;
  observations: string | null;
  refusedAt: string | null;
  status: ChampionshipRegistrationStatus;
  teamAcronym: string | null;
  teamId: string;
  teamName: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ChampionshipRegistrationPlayer = {
  active: boolean;
  athleteId: string | null;
  birthDate: string | null;
  captain: boolean;
  createdAt: string | null;
  document: string | null;
  id: string;
  name: string;
  position: string | null;
  registrationId: string;
  shirtNumber: number;
  updatedAt: string | null;
};

export type ChampionshipGroupRegistration = {
  championshipId: string;
  createdAt: string | null;
  drawPosition: number;
  groupId: string;
  id: string;
  registrationId: string;
  status: ChampionshipRegistrationStatus | null;
  teamAcronym: string | null;
  teamId: string | null;
  teamName: string | null;
  updatedAt: string | null;
};

export type ChampionshipGroup = {
  championshipId: string;
  createdAt: string | null;
  createdBy: string | null;
  displayOrder: number;
  id: string;
  name: string;
  registrations: ChampionshipGroupRegistration[];
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ChampionshipMatch = {
  awayRegistrationId: string;
  awayScore: number | null;
  awayTeamAcronym: string | null;
  awayTeamId: string | null;
  awayTeamName: string | null;
  championshipId: string;
  court: string | null;
  createdAt: string | null;
  createdBy: string | null;
  groupId: string;
  groupName: string | null;
  homeRegistrationId: string;
  homeScore: number | null;
  homeTeamAcronym: string | null;
  homeTeamId: string | null;
  homeTeamName: string | null;
  id: string;
  matchDate: string | null;
  phase: ChampionshipRoundPhase;
  roundId: string;
  roundName: string | null;
  roundNumber: number;
  resultUpdatedAt: string | null;
  resultUpdatedBy: string | null;
  startTime: string | null;
  status: ChampionshipMatchStatus;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ChampionshipRound = {
  championshipId: string;
  createdAt: string | null;
  createdBy: string | null;
  id: string;
  matches: ChampionshipMatch[];
  name: string | null;
  phase: ChampionshipRoundPhase;
  roundNumber: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ChampionshipMatchEvent = {
  championshipId: string;
  createdAt: string | null;
  createdBy: string | null;
  description: string | null;
  eventType: ChampionshipMatchEventType;
  id: string;
  matchId: string;
  metadata: Record<string, unknown>;
  minute: number | null;
  period: string | null;
  playerId: string | null;
  playerName: string | null;
  playerShirtNumber: number | null;
  relatedPlayerId: string | null;
  relatedPlayerName: string | null;
  relatedPlayerShirtNumber: number | null;
  reportId: string;
  teamAcronym: string | null;
  teamName: string | null;
  teamRegistrationId: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ChampionshipMatchReport = {
  assistantReferee: string | null;
  awayScore: number | null;
  calculatedAwayScore: number;
  calculatedHomeScore: number;
  championshipId: string;
  createdAt: string | null;
  createdBy: string | null;
  events: ChampionshipMatchEvent[];
  finishedAt: string | null;
  hasWalkover: boolean;
  homeScore: number | null;
  id: string;
  match: ChampionshipMatch | null;
  matchId: string;
  observations: string | null;
  referee: string | null;
  scorer: string | null;
  startedAt: string | null;
  status: ChampionshipMatchReportStatus;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ChampionshipMatchReportLookup = {
  match: ChampionshipMatch | null;
  report: ChampionshipMatchReport | null;
};

export type ChampionshipStanding = {
  calculatedAt: string | null;
  championshipId: string;
  draws: number;
  goalDifference: number;
  goalsAgainst: number;
  goalsFor: number;
  groupDisplayOrder: number;
  groupId: string;
  groupName: string | null;
  groupPosition: number;
  id: string | null;
  losses: number;
  overallPosition: number;
  played: number;
  points: number;
  position: number;
  registrationId: string;
  teamAcronym: string | null;
  teamId: string | null;
  teamName: string | null;
  tieBreakers: ChampionshipStandingTieBreaker[];
  updatedAt: string | null;
  wins: number;
};

export type ChampionshipStandingGroup = {
  groupDisplayOrder: number;
  groupId: string | null;
  groupName: string | null;
  items: ChampionshipStanding[];
  total: number;
};

export type ChampionshipPaginatedResponse<T> = {
  items: T[];
  limit: number;
  page: number;
  total: number;
};

export type ChampionshipStandingResponse = ChampionshipPaginatedResponse<ChampionshipStanding> & {
  calculatedAt: string | null;
  criteria: ChampionshipStandingTieBreaker[];
  groups: ChampionshipStandingGroup[];
};

export type ChampionshipStatisticsSummary = {
  calculatedAt: string | null;
  championshipId: string;
  finishedMatches: number;
  goalsAverage: number;
  goalsScored: number;
  id: string | null;
  matchesPlayed: number;
  redCards: number;
  updatedAt: string | null;
  walkovers: number;
  yellowCards: number;
};

export type ChampionshipTeamStatistics = {
  calculatedAt: string | null;
  championshipId: string;
  draws: number;
  goalDifference: number;
  goalsAgainst: number;
  goalsFor: number;
  id: string | null;
  losses: number;
  matches: number;
  performance: number;
  points: number;
  redCards: number;
  registrationId: string;
  resultStreak: string[];
  teamAcronym: string | null;
  teamId: string | null;
  teamName: string | null;
  updatedAt: string | null;
  walkovers: number;
  wins: number;
  yellowCards: number;
};

export type ChampionshipPlayerStatistics = {
  calculatedAt: string | null;
  championshipId: string;
  goals: number;
  id: string | null;
  matches: number;
  playerId: string;
  playerName: string | null;
  redCards: number;
  registrationId: string | null;
  shirtNumber: number | null;
  teamAcronym: string | null;
  teamId: string | null;
  teamName: string | null;
  updatedAt: string | null;
  yellowCards: number;
};

export type ChampionshipTopScorerRankingItem = ChampionshipPlayerStatistics & {
  position: number;
};

export type ChampionshipTeamRankingItem = ChampionshipTeamStatistics & {
  fairPlayScore?: number;
  position: number;
};

export type ChampionshipRankings = {
  bestAttack: ChampionshipTeamRankingItem[];
  bestDefense: ChampionshipTeamRankingItem[];
  fairPlay: ChampionshipTeamRankingItem[];
  topScorers: ChampionshipTopScorerRankingItem[];
};

export type ChampionshipStatisticsResponse = {
  athletes: ChampionshipPlayerStatistics[];
  calculatedAt: string | null;
  championship: ChampionshipStatisticsSummary | null;
  championshipId: string | null;
  rankings: ChampionshipRankings;
  teams: ChampionshipTeamStatistics[];
  totalAthletes: number;
  totalTeams: number;
};

export type ChampionshipRankingsResponse = {
  calculatedAt: string | null;
  championshipId: string | null;
  limit: number;
  rankings: ChampionshipRankings;
};

export type ChampionshipTopScorersResponse = {
  calculatedAt: string | null;
  championshipId: string | null;
  items: ChampionshipTopScorerRankingItem[];
  limit: number;
  total: number;
};

export type ChampionshipBracketMatch = {
  awayRegistrationId: string | null;
  awayScore: number | null;
  awayTeamAcronym: string | null;
  awayTeamId: string | null;
  awayTeamName: string | null;
  bracketId: string;
  championshipId: string;
  court: string | null;
  createdAt: string | null;
  createdBy: string | null;
  displayOrder: number;
  homeRegistrationId: string | null;
  homeScore: number | null;
  homeTeamAcronym: string | null;
  homeTeamId: string | null;
  homeTeamName: string | null;
  id: string;
  matchDate: string | null;
  nextMatchId: string | null;
  nextMatchSlot: ChampionshipBracketSlot | null;
  phase: ChampionshipBracketPhase;
  resultUpdatedAt: string | null;
  resultUpdatedBy: string | null;
  roundOrder: number;
  startTime: string | null;
  status: ChampionshipMatchStatus;
  thirdPlaceMatchId: string | null;
  thirdPlaceSlot: ChampionshipBracketSlot | null;
  updatedAt: string | null;
  updatedBy: string | null;
  winnerRegistrationId: string | null;
  winnerTeamAcronym: string | null;
  winnerTeamId: string | null;
  winnerTeamName: string | null;
};

export type ChampionshipBracketPhaseGroup = {
  matches: ChampionshipBracketMatch[];
  phase: ChampionshipBracketPhase;
  total: number;
};

export type ChampionshipBracket = {
  championRegistrationId: string | null;
  championshipId: string;
  createdAt: string | null;
  createdBy: string | null;
  displayOrder: number;
  id: string;
  includeThirdPlace: boolean;
  initialPhase: ChampionshipBracketPhase;
  matches: ChampionshipBracketMatch[];
  mode: ChampionshipBracketMode;
  phases: ChampionshipBracketPhaseGroup[];
  runnerUpRegistrationId: string | null;
  status: ChampionshipBracketStatus;
  teamCount: number;
  thirdPlaceRegistrationId: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ChampionshipFilters = {
  limit?: number;
  search?: string;
  status?: ChampionshipStatus | "";
};

export type ChampionshipRegistrationFilters = {
  championshipId?: string;
  limit?: number;
  page?: number;
  search?: string;
  sortBy?: "createdAt" | "status" | "teamName" | "updatedAt";
  sortDirection?: "ASC" | "DESC";
  status?: ChampionshipRegistrationStatus | "";
  teamId?: string;
};

export type ChampionshipAvailableTeamFilters = {
  championshipId?: string;
  limit?: number;
  page?: number;
  search?: string;
  sortBy?: "name" | "category" | "modality" | "status";
  sortDirection?: "ASC" | "DESC";
};

export type ChampionshipRegistrationPlayerFilters = {
  limit?: number;
  page?: number;
  position?: string;
  search?: string;
  sortBy?: "createdAt" | "name" | "position" | "shirtNumber" | "updatedAt";
  sortDirection?: "ASC" | "DESC";
  status?: ChampionshipRegistrationPlayerStatus | "";
};

export type ChampionshipGroupFilters = {
  limit?: number;
  page?: number;
  search?: string;
  sortBy?: "createdAt" | "displayOrder" | "name";
  sortDirection?: "ASC" | "DESC";
};

export type ChampionshipRoundFilters = {
  limit?: number;
  page?: number;
  phase?: ChampionshipRoundPhase | "";
  search?: string;
  sortBy?: "createdAt" | "name" | "roundNumber";
  sortDirection?: "ASC" | "DESC";
};

export type ChampionshipMatchFilters = {
  groupId?: string;
  limit?: number;
  page?: number;
  phase?: ChampionshipRoundPhase | "";
  roundId?: string;
  search?: string;
  sortBy?: "court" | "createdAt" | "matchDate" | "roundNumber" | "startTime" | "status";
  sortDirection?: "ASC" | "DESC";
  status?: ChampionshipMatchStatus | "";
};

export type ChampionshipStandingFilters = {
  criteria?: ChampionshipStandingTieBreaker[];
  groupId?: string;
  limit?: number;
  page?: number;
  sortBy?: ChampionshipStandingTieBreaker;
  sortDirection?: "ASC" | "DESC";
};

export type ChampionshipStatisticsFilters = {
  limit?: number;
  page?: number;
  search?: string;
};

export type ChampionshipRankingFilters = {
  limit?: number;
  type?: ChampionshipRankingType | "";
};

export type ChampionshipBracketFilters = {
  phase?: ChampionshipBracketPhase | "";
};

export type ChampionshipMutationPayload = {
  category: string;
  description?: string | null;
  endDate: string;
  logo?: ChampionshipLogo | null;
  metadata?: Record<string, unknown>;
  modality: string;
  name: string;
  startDate: string;
  status?: ChampionshipStatus;
};

export type ChampionshipRegistrationPayload = {
  championshipId: string;
  confirm?: boolean;
  observations?: string | null;
  teamId: string;
};

export type ChampionshipRegistrationUpdatePayload = {
  observations?: string | null;
  status?: ChampionshipRegistrationStatus;
};

export type ChampionshipRegistrationPlayerPayload = {
  active?: boolean;
  athleteId?: string | null;
  birthDate?: string | null;
  captain?: boolean;
  document?: string | null;
  name: string;
  position?: string | null;
  shirtNumber: number;
};

export type ChampionshipRegistrationPlayerUpdatePayload =
  Partial<ChampionshipRegistrationPlayerPayload>;

export type ChampionshipGroupPayload = {
  displayOrder?: number | null;
  name: string;
};

export type ChampionshipGroupUpdatePayload = Partial<ChampionshipGroupPayload>;

export type ChampionshipGroupAssignmentPayload = {
  drawPosition?: number | null;
  registrationId: string;
};

export type ChampionshipGroupMovePayload = {
  drawPosition?: number | null;
  targetGroupId: string;
};

export type ChampionshipGroupDrawPayload = {
  groupCount?: number | null;
  shuffle?: boolean;
};

export type ChampionshipRoundPayload = {
  name?: string | null;
  phase?: ChampionshipRoundPhase;
  roundNumber?: number | null;
};

export type ChampionshipRoundUpdatePayload = Partial<ChampionshipRoundPayload>;

export type ChampionshipMatchPayload = {
  awayRegistrationId: string;
  awayScore?: number | null;
  court?: string | null;
  groupId: string;
  homeRegistrationId: string;
  homeScore?: number | null;
  matchDate?: string | null;
  startTime?: string | null;
  status?: ChampionshipMatchStatus;
};

export type ChampionshipMatchUpdatePayload = Partial<ChampionshipMatchPayload>;

export type ChampionshipMatchMovePayload = {
  targetRoundId: string;
};

export type ChampionshipMatchReportPayload = {
  assistantReferee?: string | null;
  observations?: string | null;
  referee?: string | null;
  scorer?: string | null;
};

export type ChampionshipMatchEventPayload = {
  description?: string | null;
  eventType: ChampionshipMatchEventType;
  metadata?: Record<string, unknown>;
  minute?: number | null;
  period?: string | null;
  playerId?: string | null;
  relatedPlayerId?: string | null;
  teamRegistrationId?: string | null;
};

export type ChampionshipMatchEventUpdatePayload = Partial<ChampionshipMatchEventPayload>;

export type ChampionshipMatchReportFinalizePayload = {
  awayScore?: number;
  homeScore?: number;
};

export type ChampionshipGenerateMatchesPayload = {
  phase?: ChampionshipRoundPhase;
  replace?: boolean;
};

export type ChampionshipGenerateMatchesResponse =
  ChampionshipPaginatedResponse<ChampionshipRound> & {
    generated: number;
    phase: ChampionshipRoundPhase;
  };

export type ChampionshipStandingRecalculatePayload = {
  criteria?: ChampionshipStandingTieBreaker[];
};

export type ChampionshipStatisticsRecalculatePayload = Record<string, never>;

export type ChampionshipGenerateBracketPayload = {
  includeThirdPlace?: boolean;
  initialPhase?: ChampionshipBracketPhase;
  manualMatches?: Array<{
    awayRegistrationId?: string | null;
    displayOrder?: number | null;
    homeRegistrationId?: string | null;
  }>;
  mode?: ChampionshipBracketMode;
  replace?: boolean;
  teamCount?: number | null;
};

export type ChampionshipBracketMatchUpdatePayload = {
  awayRegistrationId?: string | null;
  awayScore?: number | null;
  court?: string | null;
  homeRegistrationId?: string | null;
  homeScore?: number | null;
  matchDate?: string | null;
  startTime?: string | null;
  status?: ChampionshipMatchStatus;
  winnerRegistrationId?: string | null;
};

export type ChampionshipBracketMatchAdvancePayload = {
  winnerRegistrationId?: string | null;
};
