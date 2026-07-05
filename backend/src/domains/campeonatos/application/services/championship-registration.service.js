const {
  toRegistrationAdminDto,
  toRegistrationAdminListDto,
  toTeamAdminListDto,
} = require("../dtos/index.js");
const {
  validateAvailableTeamsInput,
  validateCreateRegistrationInput,
  validateRegistrationId,
  validateRegistrationListInput,
  validateUpdateRegistrationInput,
  validateUpdateRegistrationStatusInput,
} = require("../validators/index.js");
const { RegistrationStatus } = require("../../shared/enums/index.js");
const { controlledError, nullableText, text } = require("../../shared/utils/index.js");

const REGISTRATION_REPOSITORY_REQUIRED_CODE = "CHAMPIONSHIP_REGISTRATION_REPOSITORY_REQUIRED";
const REGISTRATION_NOT_FOUND_CODE = "CHAMPIONSHIP_REGISTRATION_NOT_FOUND";
const REGISTRATION_DUPLICATE_CODE = "CHAMPIONSHIP_REGISTRATION_DUPLICATE";
const REGISTRATION_TEAM_NOT_FOUND_CODE = "CHAMPIONSHIP_REGISTRATION_TEAM_NOT_FOUND";
const REGISTRATION_CHAMPIONSHIP_NOT_FOUND_CODE = "CHAMPIONSHIP_REGISTRATION_CHAMPIONSHIP_NOT_FOUND";

const CLOSED_CHAMPIONSHIP_STATUSES = new Set([
  "ARCHIVED",
  "CANCELADO",
  "CANCELADA",
  "CANCELED",
  "CANCELLED",
  "ENCERRADO",
  "ENCERRADA",
  "ENDED",
  "FINISHED",
  "REMOVED",
]);

const ACTIVE_REGISTRATION_STATUSES = new Set([
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.PENDING,
]);

class ChampionshipRegistrationService {
  constructor(options = {}) {
    this.championshipRepository = options.championshipRepository || null;
    this.registrationRepository =
      options.registrationRepository || options.repository || options.championshipRegistrationRepository || null;
  }

  async register(input = {}, context = {}) {
    const values = validateCreateRegistrationInput(input);
    const championship = await this.requireChampionship(values.championshipId);
    const team = await this.requireTeam(values.teamId);

    this.ensureChampionshipOpen(championship);
    this.ensureTeamCompatible(championship, team);
    await this.ensureNoDuplicate(values.championshipId, values.teamId);
    await this.ensureChampionshipCapacity(championship);

    const status = values.confirm ? RegistrationStatus.CONFIRMED : RegistrationStatus.PENDING;
    const registration = await this.getRegistrationRepository().create({
      ...values,
      category: readTeamField(team, "category"),
      createdBy: readActor(context),
      modality: readTeamField(team, "modality"),
      status,
      teamAcronym: readTeamField(team, "acronym"),
      updatedBy: readActor(context),
    });

    return toRegistrationAdminDto(registration);
  }

  async cancel(registrationId, input = {}, context = {}) {
    const id = validateRegistrationId(registrationId);
    await this.requireRegistration(id);

    const registration = await this.getRegistrationRepository().update(id, {
      observations: Object.prototype.hasOwnProperty.call(input, "observations")
        ? nullableText(input.observations, 2000)
        : undefined,
      status: RegistrationStatus.CANCELLED,
      updatedBy: readActor(context),
    });

    return this.requireRegistrationDto(registration, id);
  }

  async update(registrationId, input = {}, context = {}) {
    const id = validateRegistrationId(registrationId);
    const values = validateUpdateRegistrationInput(input);
    await this.requireRegistration(id);

    const registration = await this.getRegistrationRepository().update(id, {
      ...values,
      updatedBy: readActor(context),
    });

    return this.requireRegistrationDto(registration, id);
  }

  async updateStatus(registrationId, input = {}, context = {}) {
    const id = validateRegistrationId(registrationId);
    const values = validateUpdateRegistrationStatusInput(input);
    await this.requireRegistration(id);

    const payload = {
      status: values.status,
      updatedBy: readActor(context),
    };

    if (typeof values.observations !== "undefined") {
      payload.observations = values.observations;
    }

    const registration = await this.getRegistrationRepository().update(id, payload);
    return this.requireRegistrationDto(registration, id);
  }

  async findById(registrationId) {
    const id = validateRegistrationId(registrationId);
    const registration = await this.getRegistrationRepository().findById(id);

    return this.requireRegistrationDto(registration, id);
  }

  async findAll(input = {}) {
    const filters = validateRegistrationListInput(input);
    const result = await this.getRegistrationRepository().findAll(filters);
    const items = Array.isArray(result?.items) ? result.items : result;
    const total = Number.isFinite(Number(result?.total)) ? Number(result.total) : items.length;

    return {
      items: toRegistrationAdminListDto(items),
      limit: filters.limit,
      page: filters.page,
      total,
    };
  }

  async findAvailableTeams(input = {}) {
    const filters = validateAvailableTeamsInput(input);
    const championship = await this.requireChampionship(filters.championshipId);
    this.ensureChampionshipOpen(championship);
    const result = await this.getRegistrationRepository().findAvailableTeams({
      ...filters,
      category: readChampionshipField(championship, "category"),
      modality: readChampionshipField(championship, "modality"),
    });
    const items = Array.isArray(result?.items) ? result.items : result;
    const total = Number.isFinite(Number(result?.total)) ? Number(result.total) : items.length;

    return {
      items: toTeamAdminListDto(items),
      limit: filters.limit,
      page: filters.page,
      total,
    };
  }

  async requireChampionship(championshipId) {
    if (!this.championshipRepository) {
      throw controlledError(
        "ChampionshipRepository nao configurado para inscricoes.",
        "CHAMPIONSHIP_REPOSITORY_REQUIRED",
        500,
      );
    }

    const championship = await this.championshipRepository.findById(championshipId);

    if (!championship) {
      throw controlledError(
        "Campeonato nao encontrado para inscricao.",
        REGISTRATION_CHAMPIONSHIP_NOT_FOUND_CODE,
        404,
        { championshipId },
      );
    }

    return championship;
  }

  async requireTeam(teamId) {
    const team = await this.getRegistrationRepository().findTeamById(teamId);

    if (!team) {
      throw controlledError("Equipe nao encontrada para inscricao.", REGISTRATION_TEAM_NOT_FOUND_CODE, 404, {
        teamId,
      });
    }

    return team;
  }

  async requireRegistration(registrationId) {
    const registration = await this.getRegistrationRepository().findById(registrationId);
    return this.requireRegistrationDto(registration, registrationId);
  }

  requireRegistrationDto(registration, registrationId) {
    if (!registration) {
      throw controlledError("Inscricao nao encontrada.", REGISTRATION_NOT_FOUND_CODE, 404, {
        registrationId,
      });
    }

    return toRegistrationAdminDto(registration);
  }

  ensureChampionshipOpen(championship) {
    const status = normalizeComparison(readChampionshipField(championship, "status"));
    const metadataStatus = normalizeComparison(
      readMetadataValue(championship, "lifecycleStatus") ||
        readMetadataValue(championship, "status") ||
        readMetadataValue(championship, "situacao"),
    );

    if (CLOSED_CHAMPIONSHIP_STATUSES.has(status) || CLOSED_CHAMPIONSHIP_STATUSES.has(metadataStatus)) {
      throw controlledError(
        "Inscricoes nao sao permitidas para campeonatos encerrados ou cancelados.",
        "CHAMPIONSHIP_REGISTRATION_CHAMPIONSHIP_CLOSED",
        409,
        { championshipId: readChampionshipField(championship, "id"), status },
      );
    }
  }

  ensureTeamCompatible(championship, team) {
    const championshipCategory = readChampionshipField(championship, "category");
    const teamCategory = readTeamField(team, "category");
    const championshipModality = readChampionshipField(championship, "modality");
    const teamModality = readTeamField(team, "modality");

    if (!championshipCategory || !teamCategory || normalizeComparison(championshipCategory) !== normalizeComparison(teamCategory)) {
      throw controlledError(
        "Categoria da equipe nao compativel com o campeonato.",
        "CHAMPIONSHIP_REGISTRATION_CATEGORY_MISMATCH",
        409,
        { championshipCategory, teamCategory },
      );
    }

    if (!championshipModality || !teamModality || normalizeComparison(championshipModality) !== normalizeComparison(teamModality)) {
      throw controlledError(
        "Modalidade da equipe nao compativel com o campeonato.",
        "CHAMPIONSHIP_REGISTRATION_MODALITY_MISMATCH",
        409,
        { championshipModality, teamModality },
      );
    }
  }

  async ensureNoDuplicate(championshipId, teamId) {
    const duplicate = await this
      .getRegistrationRepository()
      .findByChampionshipAndTeam(championshipId, teamId);

    if (duplicate) {
      throw controlledError(
        "Equipe ja inscrita neste campeonato.",
        REGISTRATION_DUPLICATE_CODE,
        409,
        { championshipId, teamId },
      );
    }
  }

  async ensureChampionshipCapacity(championship) {
    const maxTeams = readMaxTeams(championship);

    if (!maxTeams) return;

    const currentTotal = await this
      .getRegistrationRepository()
      .countActiveByChampionship(readChampionshipField(championship, "id"));

    if (currentTotal >= maxTeams) {
      throw controlledError(
        "Limite maximo de equipes atingido para este campeonato.",
        "CHAMPIONSHIP_REGISTRATION_MAX_TEAMS_REACHED",
        409,
        { currentTotal, maxTeams },
      );
    }
  }

  getRegistrationRepository() {
    if (!this.registrationRepository) {
      throw controlledError(
        "ChampionshipRegistrationRepository nao configurado.",
        REGISTRATION_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.registrationRepository;
  }
}

function readActor(context = {}) {
  return (
    nullableText(
      context.actorId ||
        context.user?.email ||
        context.user?.login ||
        context.user?.id ||
        context.auth?.email ||
        context.auth?.login ||
        context.auth?.id,
      191,
    ) || "sistema"
  );
}

function readMaxTeams(championship) {
  const value =
    readChampionshipField(championship, "maxTeams") ||
    readMetadataValue(championship, "maxTeams") ||
    readMetadataValue(championship, "limiteEquipes") ||
    readMetadataValue(championship, "teamLimit");
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function readMetadataValue(source, key) {
  const metadata = source?.metadata || {};
  return metadata && typeof metadata === "object" ? metadata[key] : null;
}

function readChampionshipField(championship, fieldName) {
  return championship?.[fieldName] ?? championship?.toJSON?.()?.[fieldName] ?? null;
}

function readTeamField(team, fieldName) {
  return team?.[fieldName] ?? team?.toJSON?.()?.[fieldName] ?? null;
}

function normalizeComparison(value) {
  return text(value, 191)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-\s]+/g, "_")
    .toUpperCase();
}

module.exports = {
  ACTIVE_REGISTRATION_STATUSES,
  ChampionshipRegistrationService,
  REGISTRATION_DUPLICATE_CODE,
  REGISTRATION_NOT_FOUND_CODE,
  REGISTRATION_REPOSITORY_REQUIRED_CODE,
};
