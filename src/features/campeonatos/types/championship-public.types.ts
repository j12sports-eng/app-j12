export type PublicChampionshipStatus = "PUBLISHED";

export type PublicMatchStatus = "SCHEDULED" | "FINISHED" | "POSTPONED" | "CANCELLED";

export type PublicRoundPhase = "GROUP_STAGE" | string;

export type PublicBracketStatus = "DRAFT" | "READY" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";

export type PublicBracketMode = "AUTOMATIC" | "MANUAL" | string;

export type PublicBracketPhase =
  | "ROUND_OF_32"
  | "ROUND_OF_16"
  | "QUARTER_FINAL"
  | "SEMI_FINAL"
  | "FINAL"
  | "THIRD_PLACE"
  | string;

export type PublicAsset = {
  mimeType: string | null;
  originalName: string | null;
  publicUrl: string | null;
  sizeBytes: number | null;
};

export type PublicPaginatedResponse<T> = {
  items: T[];
  limit: number;
  page: number;
  total: number;
};

export type PublicChampionship = {
  category: string | null;
  description: string | null;
  endDate: string | null;
  id: string;
  logo: PublicAsset | null;
  modality: string | null;
  name: string | null;
  publishedAt: string | null;
  startDate: string | null;
  status: PublicChampionshipStatus;
};

export type PublicChampionshipListFilters = {
  category?: string;
  limit?: number;
  modality?: string;
  page?: number;
  search?: string;
  sortBy?: "category" | "modality" | "name" | "publishedAt" | "startDate";
  sortDirection?: "ASC" | "DESC";
};

export type PublicPaginationFilters = {
  limit?: number;
  page?: number;
};

export type PublicTeamSummary = {
  acronym: string | null;
  drawPosition: number | null;
  groupId: string | null;
  groupName: string | null;
  registrationId: string | null;
  status: string | null;
  teamId: string | null;
  teamName: string | null;
};

export type PublicTechnicalCommissionMember = {
  name: string | null;
  role: string | null;
};

export type PublicTeam = {
  acronym: string | null;
  assistantCoach: string | null;
  category: string | null;
  championshipId: string | null;
  city: string | null;
  coach: string | null;
  logo: PublicAsset | null;
  modality: string | null;
  primaryColor: string | null;
  primaryUniform: string | null;
  registrationId: string | null;
  secondaryColor: string | null;
  secondaryUniform: string | null;
  state: string | null;
  status: string | null;
  teamId: string | null;
  teamName: string | null;
  technicalCommission: PublicTechnicalCommissionMember[];
};

export type PublicGroup = {
  championshipId: string | null;
  displayOrder: number;
  id: string | null;
  name: string | null;
  teams: PublicTeamSummary[];
  totalTeams: number;
};

export type PublicGroupTeamsResponse = PublicPaginatedResponse<PublicTeamSummary> & {
  groupId: string | null;
  groupName: string | null;
};

export type PublicMatchTeam = {
  acronym: string | null;
  registrationId: string | null;
  score: number | null;
  teamId: string | null;
  teamName: string | null;
  type: string;
};

export type PublicMatchScore = {
  away: number | null;
  home: number | null;
};

export type PublicMatch = {
  away: PublicMatchTeam;
  awayScore: number | null;
  championshipId: string | null;
  court: string | null;
  groupId: string | null;
  groupName: string | null;
  home: PublicMatchTeam;
  homeScore: number | null;
  id: string | null;
  matchDate: string | null;
  phase: PublicRoundPhase | null;
  roundId: string | null;
  roundName: string | null;
  roundNumber: number | null;
  score: PublicMatchScore;
  startTime: string | null;
  status: PublicMatchStatus | null;
};

export type PublicStandingTeam = {
  acronym: string | null;
  registrationId: string | null;
  teamId: string | null;
  teamName: string | null;
};

export type PublicStanding = {
  draws: number;
  goalDifference: number;
  goalsAgainst: number;
  goalsFor: number;
  groupId: string | null;
  groupName: string | null;
  groupPosition: number;
  losses: number;
  overallPosition: number;
  played: number;
  points: number;
  position: number;
  team: PublicStandingTeam;
  wins: number;
};

export type PublicStandingGroup = {
  groupDisplayOrder: number;
  groupId: string | null;
  groupName: string | null;
  items: PublicStanding[];
  total: number;
};

export type PublicStandingResponse = PublicPaginatedResponse<PublicStanding> & {
  calculatedAt: string | null;
  criteria: string[];
  groups: PublicStandingGroup[];
};

export type PublicBracketWinner = {
  acronym: string | null;
  registrationId: string | null;
  teamId: string | null;
  teamName: string | null;
};

export type PublicBracketMatch = {
  away: PublicMatchTeam;
  awayScore: number | null;
  bracketId: string | null;
  court: string | null;
  displayOrder: number;
  home: PublicMatchTeam;
  homeScore: number | null;
  id: string | null;
  matchDate: string | null;
  nextMatchId: string | null;
  nextMatchSlot: string | null;
  phase: PublicBracketPhase | null;
  roundOrder: number;
  score: PublicMatchScore;
  startTime: string | null;
  status: PublicMatchStatus | null;
  thirdPlaceMatchId: string | null;
  thirdPlaceSlot: string | null;
  winner: PublicBracketWinner | null;
  winnerRegistrationId: string | null;
};

export type PublicBracketPhaseGroup = {
  matches: PublicBracketMatch[];
  phase: PublicBracketPhase | null;
  total: number;
};

export type PublicBracket = {
  championRegistrationId: string | null;
  championshipId: string | null;
  id: string | null;
  includeThirdPlace: boolean;
  initialPhase: PublicBracketPhase | null;
  matches: PublicBracketMatch[];
  mode: PublicBracketMode | null;
  phases: PublicBracketPhaseGroup[];
  runnerUpRegistrationId: string | null;
  status: PublicBracketStatus | null;
  teamCount: number;
  thirdPlaceRegistrationId: string | null;
};

export type PublicChampionshipStatisticsSummary = {
  calculatedAt: string | null;
  championshipId: string | null;
  finishedMatches: number;
  goalsAverage: number;
  goalsScored: number;
  matchesPlayed: number;
  redCards: number;
  walkovers: number;
  yellowCards: number;
};

export type PublicTeamStatistics = {
  draws: number;
  goalDifference: number;
  goalsAgainst: number;
  goalsFor: number;
  losses: number;
  matches: number;
  performance: number;
  points: number;
  position: number;
  redCards: number;
  registrationId: string | null;
  resultStreak: string[];
  teamAcronym: string | null;
  teamId: string | null;
  teamName: string | null;
  walkovers: number;
  wins: number;
  yellowCards: number;
};

export type PublicPlayerStatistics = {
  goals: number;
  matches: number;
  playerId: string | null;
  playerName: string | null;
  position: number;
  redCards: number;
  registrationId: string | null;
  shirtNumber: number | null;
  teamAcronym: string | null;
  teamId: string | null;
  teamName: string | null;
  yellowCards: number;
};

export type PublicRankings = {
  bestAttack: PublicTeamStatistics[];
  bestDefense: PublicTeamStatistics[];
  fairPlay: PublicTeamStatistics[];
  topScorers: PublicPlayerStatistics[];
};

export type PublicStatisticsResponse = {
  athletes: PublicPlayerStatistics[];
  calculatedAt: string | null;
  championship: PublicChampionshipStatisticsSummary | null;
  championshipId: string | null;
  rankings: PublicRankings;
  teams: PublicTeamStatistics[];
  totalAthletes: number;
  totalTeams: number;
};

export type PublicTopScorersResponse = {
  calculatedAt: string | null;
  championshipId: string | null;
  items: PublicPlayerStatistics[];
  limit: number;
  total: number;
};
