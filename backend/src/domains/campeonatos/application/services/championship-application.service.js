const { toChampionshipAdminDto, toChampionshipAdminListDto } = require("../dtos/index.js");
const {
  validateChampionshipId,
  validateChampionshipListInput,
  validateCreateChampionshipInput,
  validateUpdateChampionshipInput,
} = require("../validators/index.js");
const { ChampionshipStatus } = require("../../shared/enums/index.js");
const {
  controlledError,
  normalizeDateRange,
  nullableText,
} = require("../../shared/utils/index.js");

const CHAMPIONSHIP_REPOSITORY_REQUIRED_CODE = "CHAMPIONSHIP_REPOSITORY_REQUIRED";
const CHAMPIONSHIP_NOT_FOUND_CODE = "CHAMPIONSHIP_NOT_FOUND";

class ChampionshipApplicationService {
  constructor(options = {}) {
    this.championshipRepository = options.championshipRepository || options.repository || null;
  }

  async create(input = {}, context = {}) {
    const values = validateCreateChampionshipInput(input);
    const championship = await this.getRepository().create({
      ...values,
      createdBy: readActor(context),
      updatedBy: readActor(context),
    });

    return toChampionshipAdminDto(championship);
  }

  async update(championshipId, input = {}, context = {}) {
    const id = validateChampionshipId(championshipId);
    const values = validateUpdateChampionshipInput(input);
    await this.validateUpdateDateRange(id, values);
    const championship = await this.getRepository().update(id, {
      ...values,
      updatedBy: readActor(context),
    });

    return this.requireChampionship(championship, id);
  }

  async remove(championshipId, context = {}) {
    const id = validateChampionshipId(championshipId);
    const championship = await this.getRepository().remove(id, {
      updatedBy: readActor(context),
    });

    return this.requireChampionship(championship, id);
  }

  async findById(championshipId) {
    const id = validateChampionshipId(championshipId);
    const championship = await this.getRepository().findById(id);

    return this.requireChampionship(championship, id);
  }

  async findAll(input = {}) {
    const filters = validateChampionshipListInput(input);
    const championships = await this.getRepository().findAll(filters);

    return {
      items: toChampionshipAdminListDto(championships),
      limit: filters.limit,
      total: championships.length,
    };
  }

  async publish(championshipId, context = {}) {
    const id = validateChampionshipId(championshipId);
    const championship = await this.getRepository().publish(id, {
      status: ChampionshipStatus.PUBLISHED,
      updatedBy: readActor(context),
    });

    return this.requireChampionship(championship, id);
  }

  async archive(championshipId, context = {}) {
    const id = validateChampionshipId(championshipId);
    const championship = await this.getRepository().archive(id, {
      status: ChampionshipStatus.ARCHIVED,
      updatedBy: readActor(context),
    });

    return this.requireChampionship(championship, id);
  }

  requireChampionship(championship, id) {
    if (!championship) {
      throw controlledError("Campeonato nao encontrado.", CHAMPIONSHIP_NOT_FOUND_CODE, 404, {
        championshipId: id,
      });
    }

    return toChampionshipAdminDto(championship);
  }

  async validateUpdateDateRange(id, values = {}) {
    const hasStartDate = Object.prototype.hasOwnProperty.call(values, "startDate");
    const hasEndDate = Object.prototype.hasOwnProperty.call(values, "endDate");

    if (hasStartDate === hasEndDate) {
      return;
    }

    const current = await this.getRepository().findById(id);
    const championship = this.requireChampionship(current, id);

    normalizeDateRange(
      hasStartDate ? values.startDate : championship.startDate,
      hasEndDate ? values.endDate : championship.endDate,
    );
  }

  getRepository() {
    if (!this.championshipRepository) {
      throw controlledError(
        "ChampionshipRepository nao configurado.",
        CHAMPIONSHIP_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.championshipRepository;
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

module.exports = {
  CHAMPIONSHIP_NOT_FOUND_CODE,
  CHAMPIONSHIP_REPOSITORY_REQUIRED_CODE,
  ChampionshipApplicationService,
};
