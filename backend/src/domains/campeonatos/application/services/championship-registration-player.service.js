const {
  toRegistrationPlayerAdminDto,
  toRegistrationPlayerAdminListDto,
} = require("../dtos/index.js");
const {
  validateCreateRegistrationPlayerInput,
  validateRegistrationPlayerId,
  validateRegistrationPlayerListInput,
  validateRegistrationPlayerRegistrationId,
  validateSetCaptainInput,
  validateUpdateRegistrationPlayerInput,
} = require("../validators/index.js");
const { RegistrationStatus } = require("../../shared/enums/index.js");
const { controlledError, nullableText } = require("../../shared/utils/index.js");

const REGISTRATION_PLAYER_REPOSITORY_REQUIRED_CODE =
  "CHAMPIONSHIP_REGISTRATION_PLAYER_REPOSITORY_REQUIRED";
const REGISTRATION_PLAYER_REGISTRATION_REPOSITORY_REQUIRED_CODE =
  "CHAMPIONSHIP_REGISTRATION_PLAYER_REGISTRATION_REPOSITORY_REQUIRED";
const REGISTRATION_PLAYER_NOT_FOUND_CODE = "CHAMPIONSHIP_REGISTRATION_PLAYER_NOT_FOUND";
const REGISTRATION_PLAYER_REGISTRATION_NOT_FOUND_CODE =
  "CHAMPIONSHIP_REGISTRATION_PLAYER_REGISTRATION_NOT_FOUND";
const REGISTRATION_PLAYER_DUPLICATE_SHIRT_CODE =
  "CHAMPIONSHIP_REGISTRATION_PLAYER_DUPLICATE_SHIRT_NUMBER";
const REGISTRATION_PLAYER_CANCELLED_REGISTRATION_CODE =
  "CHAMPIONSHIP_REGISTRATION_PLAYER_REGISTRATION_CANCELLED";
const REGISTRATION_PLAYER_INACTIVE_CAPTAIN_CODE =
  "CHAMPIONSHIP_REGISTRATION_PLAYER_INACTIVE_CAPTAIN";

class ChampionshipRegistrationPlayerService {
  constructor(options = {}) {
    this.registrationRepository =
      options.registrationRepository || options.championshipRegistrationRepository || null;
    this.playerRepository =
      options.playerRepository ||
      options.registrationPlayerRepository ||
      options.championshipRegistrationPlayerRepository ||
      null;
  }

  async create(registrationId, input = {}, context = {}) {
    const id = validateRegistrationPlayerRegistrationId(registrationId);
    const values = validateCreateRegistrationPlayerInput(input);
    await this.requireMutableRegistration(id);
    await this.ensureShirtNumberAvailable(id, values.shirtNumber, null, values.active);

    const player = await this.getPlayerRepository().create({
      ...values,
      captain: false,
      createdBy: readActor(context),
      registrationId: id,
      updatedBy: readActor(context),
    });

    if (values.captain && values.active) {
      return this.setCaptain(id, readPlayerField(player, "id"), { captain: true }, context);
    }

    return this.requirePlayerDto(player, id, readPlayerField(player, "id"));
  }

  async update(registrationId, playerId, input = {}, context = {}) {
    const registration = validateRegistrationPlayerRegistrationId(registrationId);
    const id = validateRegistrationPlayerId(playerId);
    const values = validateUpdateRegistrationPlayerInput(input);
    const current = await this.requirePlayer(registration, id);
    await this.requireMutableRegistration(registration);

    const nextActive = Object.prototype.hasOwnProperty.call(values, "active")
      ? values.active
      : readPlayerField(current, "active") !== false;
    const nextShirtNumber = Object.prototype.hasOwnProperty.call(values, "shirtNumber")
      ? values.shirtNumber
      : readPlayerField(current, "shirtNumber");

    await this.ensureShirtNumberAvailable(registration, nextShirtNumber, id, nextActive);

    const shouldSetCaptain = values.captain === true && nextActive;
    const payload = {
      ...values,
      updatedBy: readActor(context),
    };

    if (shouldSetCaptain) {
      delete payload.captain;
    } else if (values.captain === false || !nextActive) {
      payload.captain = false;
    } else {
      delete payload.captain;
    }

    const updated = await this.getPlayerRepository().update(registration, id, payload);

    if (shouldSetCaptain) {
      return this.setCaptain(registration, id, { captain: true }, context);
    }

    return this.requirePlayerDto(updated, registration, id);
  }

  async delete(registrationId, playerId, context = {}) {
    const registration = validateRegistrationPlayerRegistrationId(registrationId);
    const id = validateRegistrationPlayerId(playerId);
    await this.requirePlayer(registration, id);
    await this.requireMutableRegistration(registration);

    const player = await this.getPlayerRepository().deactivate(registration, id, {
      updatedBy: readActor(context),
    });

    return this.requirePlayerDto(player, registration, id);
  }

  async findById(registrationId, playerId) {
    const registration = validateRegistrationPlayerRegistrationId(registrationId);
    const id = validateRegistrationPlayerId(playerId);
    const player = await this.getPlayerRepository().findByRegistrationAndId(registration, id);

    return this.requirePlayerDto(player, registration, id);
  }

  async findAll(registrationId, input = {}) {
    const registration = validateRegistrationPlayerRegistrationId(registrationId);
    await this.requireRegistration(registration);

    const filters = validateRegistrationPlayerListInput(input);
    const result = await this.getPlayerRepository().findAllByRegistration(registration, filters);
    const items = Array.isArray(result?.items) ? result.items : result;
    const total = Number.isFinite(Number(result?.total)) ? Number(result.total) : items.length;

    return {
      items: toRegistrationPlayerAdminListDto(items),
      limit: filters.limit,
      page: filters.page,
      total,
    };
  }

  async setCaptain(registrationId, playerId, input = {}, context = {}) {
    const registration = validateRegistrationPlayerRegistrationId(registrationId);
    const id = validateRegistrationPlayerId(playerId);
    const values = validateSetCaptainInput(input);
    const player = await this.requirePlayer(registration, id);
    await this.requireMutableRegistration(registration);

    if (values.captain && readPlayerField(player, "active") === false) {
      throw controlledError(
        "Atleta inativo nao pode ser capitao.",
        REGISTRATION_PLAYER_INACTIVE_CAPTAIN_CODE,
        409,
        { playerId: id, registrationId: registration },
      );
    }

    const updated = await this.getPlayerRepository().setCaptain(registration, id, {
      captain: values.captain,
      updatedBy: readActor(context),
    });

    return this.requirePlayerDto(updated, registration, id);
  }

  async requireRegistration(registrationId) {
    const repository = this.getRegistrationRepository();
    const registration = await repository.findById(registrationId);

    if (!registration) {
      throw controlledError(
        "Inscricao nao encontrada para atleta.",
        REGISTRATION_PLAYER_REGISTRATION_NOT_FOUND_CODE,
        404,
        { registrationId },
      );
    }

    return registration;
  }

  async requireMutableRegistration(registrationId) {
    const registration = await this.requireRegistration(registrationId);
    const status = readRegistrationField(registration, "status");

    if (status === RegistrationStatus.CANCELLED) {
      throw controlledError(
        "Nao e permitido alterar atletas de inscricao cancelada.",
        REGISTRATION_PLAYER_CANCELLED_REGISTRATION_CODE,
        409,
        { registrationId, status },
      );
    }

    return registration;
  }

  async requirePlayer(registrationId, playerId) {
    const player = await this.getPlayerRepository().findByRegistrationAndId(
      registrationId,
      playerId,
    );

    return this.requirePlayerDto(player, registrationId, playerId);
  }

  requirePlayerDto(player, registrationId, playerId) {
    if (!player) {
      throw controlledError(
        "Atleta da inscricao nao encontrado.",
        REGISTRATION_PLAYER_NOT_FOUND_CODE,
        404,
        { playerId, registrationId },
      );
    }

    return toRegistrationPlayerAdminDto(player);
  }

  async ensureShirtNumberAvailable(registrationId, shirtNumber, ignoredPlayerId, active = true) {
    if (!active) return;

    const duplicate = await this.getPlayerRepository().findByRegistrationAndShirtNumber(
      registrationId,
      shirtNumber,
      ignoredPlayerId,
    );

    if (duplicate) {
      throw controlledError(
        "Numero de camisa ja utilizado nesta inscricao.",
        REGISTRATION_PLAYER_DUPLICATE_SHIRT_CODE,
        409,
        { ignoredPlayerId, registrationId, shirtNumber },
      );
    }
  }

  getRegistrationRepository() {
    if (!this.registrationRepository) {
      throw controlledError(
        "ChampionshipRegistrationRepository nao configurado para atletas.",
        REGISTRATION_PLAYER_REGISTRATION_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.registrationRepository;
  }

  getPlayerRepository() {
    if (!this.playerRepository) {
      throw controlledError(
        "ChampionshipRegistrationPlayerRepository nao configurado.",
        REGISTRATION_PLAYER_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.playerRepository;
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

function readPlayerField(player, fieldName) {
  return player?.[fieldName] ?? player?.toJSON?.()?.[fieldName] ?? null;
}

function readRegistrationField(registration, fieldName) {
  return registration?.[fieldName] ?? registration?.toJSON?.()?.[fieldName] ?? null;
}

module.exports = {
  ChampionshipRegistrationPlayerService,
  REGISTRATION_PLAYER_CANCELLED_REGISTRATION_CODE,
  REGISTRATION_PLAYER_DUPLICATE_SHIRT_CODE,
  REGISTRATION_PLAYER_NOT_FOUND_CODE,
  REGISTRATION_PLAYER_REPOSITORY_REQUIRED_CODE,
  REGISTRATION_PLAYER_REGISTRATION_NOT_FOUND_CODE,
};
