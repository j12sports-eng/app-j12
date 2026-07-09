function toChampionshipPublicDto(value) {
  const item = toPlainObject(value);
  if (!item) return null;

  return {
    category: item.category || null,
    description: item.description || null,
    endDate: item.endDate || null,
    id: item.id || null,
    logo: toPublicAssetDto(item.logo || item.metadata?.logo || null),
    modality: item.modality || null,
    name: item.name || null,
    publishedAt: item.publishedAt || null,
    startDate: item.startDate || null,
    status: item.status || null,
  };
}

function toChampionshipPublicListDto(values = []) {
  return values.map(toChampionshipPublicDto).filter(Boolean);
}

function toChampionshipPublicListResponseDto(input = {}) {
  const items = toChampionshipPublicListDto(input.items || []);

  return {
    items,
    limit: Number(input.limit || items.length || 20),
    page: Number(input.page || 1),
    total: Number(input.total || items.length),
  };
}

function toChampionshipGroupPublicDto(value) {
  const item = toPlainObject(value);
  if (!item) return null;
  const teams = toChampionshipPublicTeamSummaryListDto(item.registrations || item.teams || []);

  return {
    championshipId: item.championshipId || null,
    displayOrder: Number(item.displayOrder || 0),
    id: item.id || null,
    name: item.name || null,
    teams,
    totalTeams: teams.length,
  };
}

function toChampionshipGroupPublicListResponseDto(input = {}) {
  const items = (input.items || []).map(toChampionshipGroupPublicDto).filter(Boolean);

  return {
    items,
    limit: Number(input.limit || items.length || 100),
    page: Number(input.page || 1),
    total: Number(input.total || items.length),
  };
}

function toChampionshipPublicGroupTeamsResponseDto(input = {}) {
  const items = toChampionshipPublicTeamSummaryListDto(input.items || []);

  return {
    groupId: input.groupId || null,
    groupName: input.groupName || null,
    items,
    limit: Number(input.limit || items.length || 100),
    page: Number(input.page || 1),
    total: Number(input.total || items.length),
  };
}

function toChampionshipPublicTeamsResponseDto(input = {}) {
  const items = (input.items || []).map(toChampionshipPublicTeamDetailDto).filter(Boolean);

  return {
    items,
    limit: Number(input.limit || items.length || 100),
    page: Number(input.page || 1),
    total: Number(input.total || items.length),
  };
}

function toChampionshipPublicTeamSummaryDto(value) {
  const item = toPlainObject(value);
  if (!item) return null;

  return {
    acronym: item.teamAcronym || item.acronym || null,
    drawPosition: normalizeNumberOrNull(item.drawPosition),
    groupId: item.groupId || null,
    groupName: item.groupName || null,
    registrationId: item.registrationId || item.id || null,
    status: item.status || null,
    teamId: item.teamId || item.id || null,
    teamName: item.teamName || item.name || null,
  };
}

function toChampionshipPublicTeamSummaryListDto(values = []) {
  return values.map(toChampionshipPublicTeamSummaryDto).filter(Boolean);
}

function toChampionshipPublicRosterDto(value) {
  const item = value || {};
  const players = (item.players || []).map(toChampionshipPublicPlayerDto).filter(Boolean);

  return {
    limit: Number(item.limit || players.length || 20),
    page: Number(item.page || 1),
    players,
    team: toChampionshipPublicTeamDetailDto(item.team || item.registration),
    total: Number(item.total || players.length),
  };
}

function toChampionshipPublicTeamDetailDto(value) {
  const item = toPlainObject(value);
  if (!item) return null;

  return {
    acronym: item.teamAcronym || item.acronym || null,
    assistantCoach: item.assistantCoach || null,
    category: item.category || null,
    championshipId: item.championshipId || null,
    city: item.city || null,
    coach: item.coach || null,
    logo: toPublicAssetDto(item.logo || item.shield || null),
    modality: item.modality || null,
    primaryColor: item.primaryColor || null,
    primaryUniform: item.primaryUniform || null,
    registrationId: item.registrationId || item.id || null,
    secondaryColor: item.secondaryColor || null,
    secondaryUniform: item.secondaryUniform || null,
    state: item.state || null,
    status: item.status || null,
    teamId: item.teamId || item.id || null,
    teamName: item.teamName || item.name || null,
    technicalCommission: toPublicTechnicalCommissionListDto(item.technicalCommission || []),
  };
}

function toChampionshipPublicPlayerDto(value) {
  const item = toPlainObject(value);
  if (!item) return null;

  return {
    active: item.active !== false,
    captain: Boolean(item.captain),
    id: item.id || null,
    name: item.name || null,
    position: item.position || null,
    registrationId: item.registrationId || null,
    shirtNumber: normalizeNumberOrNull(item.shirtNumber),
  };
}

function toChampionshipMatchPublicDto(value) {
  const item = toPlainObject(value);
  if (!item) return null;

  return {
    away: toPublicMatchTeamDto(item, "away"),
    awayScore: normalizeNumberOrNull(item.awayScore),
    championshipId: item.championshipId || null,
    court: item.court || null,
    groupId: item.groupId || null,
    groupName: item.groupName || null,
    home: toPublicMatchTeamDto(item, "home"),
    homeScore: normalizeNumberOrNull(item.homeScore),
    id: item.id || null,
    matchDate: item.matchDate || null,
    phase: item.phase || null,
    roundId: item.roundId || null,
    roundName: item.roundName || null,
    roundNumber: normalizeNumberOrNull(item.roundNumber),
    score: {
      away: normalizeNumberOrNull(item.awayScore),
      home: normalizeNumberOrNull(item.homeScore),
    },
    startTime: item.startTime || null,
    status: item.status || null,
  };
}

function toChampionshipMatchPublicListResponseDto(input = {}) {
  const items = (input.items || []).map(toChampionshipMatchPublicDto).filter(Boolean);

  return {
    items,
    limit: Number(input.limit || items.length || 100),
    page: Number(input.page || 1),
    total: Number(input.total || items.length),
  };
}

function toChampionshipMatchPublicDetailDto(input = {}) {
  return {
    match: toChampionshipMatchPublicDto(input.match),
    report: toChampionshipMatchReportPublicDto(input.report),
  };
}

function toChampionshipMatchReportPublicDto(value) {
  const item = toPlainObject(value);
  if (!item || item.status === "DRAFT") return null;

  return {
    awayScore: normalizeNumberOrNull(item.awayScore),
    calculatedAwayScore: normalizeNumberOrNull(item.calculatedAwayScore),
    calculatedHomeScore: normalizeNumberOrNull(item.calculatedHomeScore),
    championshipId: item.championshipId || null,
    events: (item.events || []).map(toChampionshipMatchEventPublicDto).filter(Boolean),
    finishedAt: item.finishedAt || null,
    hasWalkover: Boolean(item.hasWalkover),
    homeScore: normalizeNumberOrNull(item.homeScore),
    matchId: item.matchId || null,
    startedAt: item.startedAt || null,
    status: item.status || null,
  };
}

function toChampionshipMatchEventPublicDto(value) {
  const item = toPlainObject(value);
  if (!item) return null;

  return {
    eventType: item.eventType || null,
    id: item.id || null,
    minute: normalizeNumberOrNull(item.minute),
    period: item.period || null,
    playerId: item.playerId || null,
    playerName: item.playerName || null,
    playerShirtNumber: normalizeNumberOrNull(item.playerShirtNumber),
    relatedPlayerId: item.relatedPlayerId || null,
    relatedPlayerName: item.relatedPlayerName || null,
    relatedPlayerShirtNumber: normalizeNumberOrNull(item.relatedPlayerShirtNumber),
    teamAcronym: item.teamAcronym || null,
    teamName: item.teamName || null,
    teamRegistrationId: item.teamRegistrationId || null,
  };
}

function toChampionshipStandingPublicResponseDto(input = {}) {
  const items = (input.items || []).map(toChampionshipStandingPublicDto).filter(Boolean);

  return {
    calculatedAt: input.calculatedAt || null,
    criteria: Array.isArray(input.criteria) ? input.criteria : [],
    groups: (input.groups || []).map(toChampionshipStandingPublicGroupDto).filter(Boolean),
    items,
    limit: Number(input.limit || items.length || 100),
    page: Number(input.page || 1),
    total: Number(input.total || items.length),
  };
}

function toChampionshipStandingPublicGroupDto(value = {}) {
  const items = (value.items || []).map(toChampionshipStandingPublicDto).filter(Boolean);

  return {
    groupDisplayOrder: Number(value.groupDisplayOrder || 0),
    groupId: value.groupId || null,
    groupName: value.groupName || null,
    items,
    total: Number(value.total || items.length),
  };
}

function toChampionshipStandingPublicDto(value) {
  const item = toPlainObject(value);
  if (!item) return null;

  return {
    draws: Number(item.draws || 0),
    goalDifference: Number(item.goalDifference || 0),
    goalsAgainst: Number(item.goalsAgainst || 0),
    goalsFor: Number(item.goalsFor || 0),
    groupId: item.groupId || null,
    groupName: item.groupName || null,
    groupPosition: Number(item.groupPosition || 0),
    losses: Number(item.losses || 0),
    overallPosition: Number(item.overallPosition || item.position || 0),
    played: Number(item.played || 0),
    points: Number(item.points || 0),
    position: Number(item.position || 0),
    team: {
      acronym: item.teamAcronym || null,
      registrationId: item.registrationId || null,
      teamId: item.teamId || null,
      teamName: item.teamName || null,
    },
    wins: Number(item.wins || 0),
  };
}

function toChampionshipBracketPublicDto(value) {
  const item = toPlainObject(value);
  if (!item) return null;
  const matches = (item.matches || []).map(toChampionshipBracketMatchPublicDto).filter(Boolean);

  return {
    championRegistrationId: item.championRegistrationId || null,
    championshipId: item.championshipId || null,
    id: item.id || null,
    includeThirdPlace: Boolean(item.includeThirdPlace),
    initialPhase: item.initialPhase || null,
    matches,
    mode: item.mode || null,
    phases: toChampionshipBracketPhasePublicListDto(matches),
    runnerUpRegistrationId: item.runnerUpRegistrationId || null,
    status: item.status || null,
    teamCount: Number(item.teamCount || 0),
    thirdPlaceRegistrationId: item.thirdPlaceRegistrationId || null,
  };
}

function toChampionshipBracketMatchPublicDto(value) {
  const item = toPlainObject(value);
  if (!item) return null;

  return {
    away: toPublicMatchTeamDto(item, "away"),
    awayScore: normalizeNumberOrNull(item.awayScore),
    bracketId: item.bracketId || null,
    court: item.court || null,
    displayOrder: Number(item.displayOrder || 0),
    home: toPublicMatchTeamDto(item, "home"),
    homeScore: normalizeNumberOrNull(item.homeScore),
    id: item.id || null,
    matchDate: item.matchDate || null,
    nextMatchId: item.nextMatchId || null,
    nextMatchSlot: item.nextMatchSlot || null,
    phase: item.phase || null,
    roundOrder: Number(item.roundOrder || 0),
    score: {
      away: normalizeNumberOrNull(item.awayScore),
      home: normalizeNumberOrNull(item.homeScore),
    },
    startTime: item.startTime || null,
    status: item.status || null,
    thirdPlaceMatchId: item.thirdPlaceMatchId || null,
    thirdPlaceSlot: item.thirdPlaceSlot || null,
    winner: toWinnerTeamDto(item),
    winnerRegistrationId: item.winnerRegistrationId || null,
  };
}

function toChampionshipBracketPhasePublicListDto(matches = []) {
  const grouped = new Map();

  for (const match of matches) {
    const current = grouped.get(match.phase) || {
      matches: [],
      phase: match.phase,
      total: 0,
    };
    current.matches.push(match);
    current.total += 1;
    grouped.set(match.phase, current);
  }

  return Array.from(grouped.values());
}

function toChampionshipStatisticsPublicResponseDto(input = {}) {
  const championship = toChampionshipStatisticsSummaryPublicDto(input.championship);
  const teams = (input.teams || []).map(toChampionshipTeamStatisticsPublicDto).filter(Boolean);
  const athletes = (input.athletes || input.players || [])
    .map(toChampionshipPlayerStatisticsPublicDto)
    .filter(Boolean);

  return {
    athletes,
    calculatedAt: input.calculatedAt || championship?.calculatedAt || null,
    championship,
    championshipId: input.championshipId || championship?.championshipId || null,
    rankings: toChampionshipRankingsPublicDto(input.rankings || {}),
    teams,
    totalAthletes: athletes.length,
    totalTeams: teams.length,
  };
}

function toChampionshipRankingsPublicResponseDto(input = {}) {
  return {
    calculatedAt: input.calculatedAt || null,
    championshipId: input.championshipId || null,
    limit: Number(input.limit || 20),
    rankings: toChampionshipRankingsPublicDto(input.rankings || {}),
  };
}

function toChampionshipTopScorersPublicResponseDto(input = {}) {
  const items = (input.items || []).map(toChampionshipPlayerStatisticsPublicDto).filter(Boolean);

  return {
    calculatedAt: input.calculatedAt || null,
    championshipId: input.championshipId || null,
    items,
    limit: Number(input.limit || 20),
    total: Number(input.total || items.length),
  };
}

function toChampionshipStatisticsSummaryPublicDto(value) {
  const item = toPlainObject(value);
  if (!item) return null;

  return {
    calculatedAt: item.calculatedAt || null,
    championshipId: item.championshipId || null,
    finishedMatches: Number(item.finishedMatches || 0),
    goalsAverage: Number(item.goalsAverage || 0),
    goalsScored: Number(item.goalsScored || 0),
    matchesPlayed: Number(item.matchesPlayed || 0),
    redCards: Number(item.redCards || 0),
    walkovers: Number(item.walkovers || 0),
    yellowCards: Number(item.yellowCards || 0),
  };
}

function toChampionshipTeamStatisticsPublicDto(value) {
  const item = toPlainObject(value);
  if (!item) return null;

  return {
    draws: Number(item.draws || 0),
    goalDifference: Number(item.goalDifference || 0),
    goalsAgainst: Number(item.goalsAgainst || 0),
    goalsFor: Number(item.goalsFor || 0),
    losses: Number(item.losses || 0),
    matches: Number(item.matches || 0),
    performance: Number(item.performance || 0),
    points: Number(item.points || 0),
    position: Number(item.position || 0),
    redCards: Number(item.redCards || 0),
    registrationId: item.registrationId || null,
    resultStreak: Array.isArray(item.resultStreak) ? item.resultStreak : [],
    teamAcronym: item.teamAcronym || null,
    teamId: item.teamId || null,
    teamName: item.teamName || null,
    walkovers: Number(item.walkovers || 0),
    wins: Number(item.wins || 0),
    yellowCards: Number(item.yellowCards || 0),
  };
}

function toChampionshipPlayerStatisticsPublicDto(value) {
  const item = toPlainObject(value);
  if (!item) return null;

  return {
    goals: Number(item.goals || 0),
    matches: Number(item.matches || 0),
    playerId: item.playerId || null,
    playerName: item.playerName || null,
    position: Number(item.position || 0),
    redCards: Number(item.redCards || 0),
    registrationId: item.registrationId || null,
    shirtNumber: normalizeNumberOrNull(item.shirtNumber),
    teamAcronym: item.teamAcronym || null,
    teamId: item.teamId || null,
    teamName: item.teamName || null,
    yellowCards: Number(item.yellowCards || 0),
  };
}

function toChampionshipRankingsPublicDto(rankings = {}) {
  return {
    bestAttack: (rankings.bestAttack || [])
      .map(toChampionshipTeamStatisticsPublicDto)
      .filter(Boolean),
    bestDefense: (rankings.bestDefense || [])
      .map(toChampionshipTeamStatisticsPublicDto)
      .filter(Boolean),
    fairPlay: (rankings.fairPlay || []).map(toChampionshipTeamStatisticsPublicDto).filter(Boolean),
    topScorers: (rankings.topScorers || [])
      .map(toChampionshipPlayerStatisticsPublicDto)
      .filter(Boolean),
  };
}

function toPublicMatchTeamDto(item = {}, side) {
  const prefix = side === "away" ? "away" : "home";
  const label = prefix.charAt(0).toUpperCase() + prefix.slice(1);

  return {
    acronym: item[`${prefix}TeamAcronym`] || null,
    registrationId: item[`${prefix}RegistrationId`] || null,
    score: normalizeNumberOrNull(item[`${prefix}Score`]),
    teamId: item[`${prefix}TeamId`] || null,
    teamName: item[`${prefix}TeamName`] || null,
    type: label,
  };
}

function toWinnerTeamDto(item = {}) {
  if (!item.winnerRegistrationId) return null;

  return {
    acronym: item.winnerTeamAcronym || null,
    registrationId: item.winnerRegistrationId,
    teamId: item.winnerTeamId || null,
    teamName: item.winnerTeamName || null,
  };
}

function toPublicAssetDto(value) {
  const item = toPlainObject(value);
  if (!item) return null;

  const output = {
    mimeType: item.mimeType || item.mime_type || null,
    originalName: item.originalName || item.original_name || null,
    publicUrl: item.publicUrl || item.public_url || item.url || null,
    sizeBytes: normalizeNumberOrNull(item.sizeBytes || item.size_bytes),
  };

  return Object.values(output).some((fieldValue) => fieldValue !== null) ? output : null;
}

function toPublicTechnicalCommissionListDto(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((member) => {
      const item = toPlainObject(member);
      if (!item) return null;

      return {
        name: item.name || item.nome || null,
        role: item.role || item.funcao || null,
      };
    })
    .filter((member) => member && (member.name || member.role));
}

function normalizeNumberOrNull(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function toPlainObject(value) {
  if (!value) return null;
  if (typeof value.toJSON === "function") return value.toJSON();
  return typeof value === "object" ? value : null;
}

module.exports = {
  toChampionshipBracketPublicDto,
  toChampionshipGroupPublicDto,
  toChampionshipGroupPublicListResponseDto,
  toChampionshipMatchPublicDetailDto,
  toChampionshipMatchPublicDto,
  toChampionshipMatchPublicListResponseDto,
  toChampionshipPublicDto,
  toChampionshipPublicGroupTeamsResponseDto,
  toChampionshipPublicListDto,
  toChampionshipPublicListResponseDto,
  toChampionshipPublicRosterDto,
  toChampionshipPublicTeamDetailDto,
  toChampionshipPublicTeamSummaryDto,
  toChampionshipPublicTeamsResponseDto,
  toChampionshipStandingPublicResponseDto,
  toChampionshipStatisticsPublicResponseDto,
  toChampionshipTopScorersPublicResponseDto,
  toChampionshipRankingsPublicResponseDto,
};
