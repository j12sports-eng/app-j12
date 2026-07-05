export type ChampionshipStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "REMOVED";

export type ChampionshipRegistrationStatus = "PENDING" | "CONFIRMED" | "REFUSED" | "CANCELLED";

export type ChampionshipTeamStatus = "ACTIVE" | "INACTIVE" | "DISQUALIFIED";

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

export type ChampionshipPaginatedResponse<T> = {
  items: T[];
  limit: number;
  page: number;
  total: number;
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
