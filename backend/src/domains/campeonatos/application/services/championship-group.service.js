const {
  toChampionshipGroupAdminDto,
  toChampionshipGroupAdminListDto,
} = require("../dtos/index.js");
const {
  validateChampionshipGroupAssignmentInput,
  validateChampionshipGroupChampionshipId,
  validateChampionshipGroupDrawInput,
  validateChampionshipGroupId,
  validateChampionshipGroupListInput,
  validateChampionshipGroupMoveInput,
  validateChampionshipGroupRegistrationRemovalInput,
  validateCreateChampionshipGroupInput,
  validateUpdateChampionshipGroupInput,
} = require("../validators/index.js");
const { RegistrationStatus } = require("../../shared/enums/index.js");
const { controlledError, nullableText } = require("../../shared/utils/index.js");

const GROUP_REPOSITORY_REQUIRED_CODE = "CHAMPIONSHIP_GROUP_REPOSITORY_REQUIRED";
const GROUP_REGISTRATION_REPOSITORY_REQUIRED_CODE =
  "CHAMPIONSHIP_GROUP_REGISTRATION_REPOSITORY_REQUIRED";
const GROUP_CHAMPIONSHIP_REPOSITORY_REQUIRED_CODE =
  "CHAMPIONSHIP_GROUP_CHAMPIONSHIP_REPOSITORY_REQUIRED";
const GROUP_CHAMPIONSHIP_NOT_FOUND_CODE = "CHAMPIONSHIP_GROUP_CHAMPIONSHIP_NOT_FOUND";
const GROUP_NOT_FOUND_CODE = "CHAMPIONSHIP_GROUP_NOT_FOUND";
const GROUP_DUPLICATE_NAME_CODE = "CHAMPIONSHIP_GROUP_DUPLICATE_NAME";
const GROUP_NOT_EMPTY_CODE = "CHAMPIONSHIP_GROUP_NOT_EMPTY";
const GROUP_REGISTRATION_NOT_FOUND_CODE = "CHAMPIONSHIP_GROUP_REGISTRATION_NOT_FOUND";
const GROUP_REGISTRATION_ALREADY_ASSIGNED_CODE = "CHAMPIONSHIP_GROUP_REGISTRATION_ALREADY_ASSIGNED";
const GROUP_REGISTRATION_CANCELLED_CODE = "CHAMPIONSHIP_GROUP_REGISTRATION_CANCELLED";
const GROUP_REGISTRATION_INACTIVE_CODE = "CHAMPIONSHIP_GROUP_REGISTRATION_INACTIVE";
const GROUP_ASSIGNMENT_NOT_FOUND_CODE = "CHAMPIONSHIP_GROUP_ASSIGNMENT_NOT_FOUND";
const GROUP_DRAW_ALREADY_HAS_ASSIGNMENTS_CODE = "CHAMPIONSHIP_GROUP_DRAW_ALREADY_HAS_ASSIGNMENTS";

const ACTIVE_REGISTRATION_STATUSES = new Set([
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.PENDING,
]);

class ChampionshipGroupService {
  constructor(options = {}) {
    this.championshipRepository = options.championshipRepository || null;
    this.registrationRepository =
      options.registrationRepository || options.championshipRegistrationRepository || null;
    this.groupRepository =
      options.groupRepository || options.championshipGroupRepository || options.repository || null;
  }

  async create(championshipId, input = {}, context = {}) {
    const values = validateCreateChampionshipGroupInput(championshipId, input);
    await this.requireChampionship(values.championshipId);
    await this.ensureGroupNameAvailable(values.championshipId, values.name, null);

    const displayOrder =
      values.displayOrder === null
        ? await this.getNextDisplayOrder(values.championshipId)
        : values.displayOrder;
    const group = await this.getGroupRepository().create({
      ...values,
      createdBy: readActor(context),
      displayOrder,
      updatedBy: readActor(context),
    });

    return toChampionshipGroupAdminDto(group);
  }

  async update(championshipId, groupId, input = {}, context = {}) {
    const values = validateUpdateChampionshipGroupInput(championshipId, groupId, input);
    const group = await this.requireGroup(values.championshipId, values.groupId);

    if (Object.prototype.hasOwnProperty.call(values, "name")) {
      await this.ensureGroupNameAvailable(values.championshipId, values.name, values.groupId);
    }

    const updated = await this.getGroupRepository().update(values.championshipId, values.groupId, {
      displayOrder: Object.prototype.hasOwnProperty.call(values, "displayOrder")
        ? values.displayOrder
        : undefined,
      name: Object.prototype.hasOwnProperty.call(values, "name") ? values.name : undefined,
      updatedBy: readActor(context),
    });

    return toChampionshipGroupAdminDto(updated || group);
  }

  async remove(championshipId, groupId) {
    const campId = validateChampionshipGroupChampionshipId(championshipId);
    const id = validateChampionshipGroupId(groupId);
    const group = await this.requireGroup(campId, id);
    const totalRegistrations = await this.getGroupRepository().countRegistrations(id);

    if (totalRegistrations > 0) {
      throw controlledError("Grupo com equipes nao pode ser removido.", GROUP_NOT_EMPTY_CODE, 409, {
        groupId: id,
        totalRegistrations,
      });
    }

    const removed = await this.getGroupRepository().delete(campId, id);
    return toChampionshipGroupAdminDto(removed || group);
  }

  async findAll(championshipId, input = {}) {
    const filters = validateChampionshipGroupListInput(championshipId, input);
    await this.requireChampionship(filters.championshipId);

    const result = await this.getGroupRepository().findAllByChampionship(filters);
    const items = Array.isArray(result?.items) ? result.items : result;
    const total = Number.isFinite(Number(result?.total)) ? Number(result.total) : items.length;

    return {
      items: toChampionshipGroupAdminListDto(items),
      limit: filters.limit,
      page: filters.page,
      total,
    };
  }

  async findById(championshipId, groupId) {
    const campId = validateChampionshipGroupChampionshipId(championshipId);
    const id = validateChampionshipGroupId(groupId);
    return toChampionshipGroupAdminDto(await this.requireGroup(campId, id));
  }

  async assignRegistration(championshipId, groupId, input = {}, context = {}) {
    const values = validateChampionshipGroupAssignmentInput(championshipId, groupId, input);
    await this.requireGroup(values.championshipId, values.groupId);
    await this.requireActiveRegistration(values.championshipId, values.registrationId);
    await this.ensureRegistrationNotAssigned(values.championshipId, values.registrationId);

    const drawPosition =
      values.drawPosition === null
        ? await this.getNextDrawPosition(values.groupId)
        : values.drawPosition;
    await this.getGroupRepository().addRegistration({
      createdBy: readActor(context),
      drawPosition,
      groupId: values.groupId,
      registrationId: values.registrationId,
    });

    return this.findById(values.championshipId, values.groupId);
  }

  async removeRegistration(championshipId, groupId, registrationId) {
    const values = validateChampionshipGroupRegistrationRemovalInput(
      championshipId,
      groupId,
      registrationId,
    );
    await this.requireGroup(values.championshipId, values.groupId);
    await this.requireAssignment(values.championshipId, values.groupId, values.registrationId);

    await this.getGroupRepository().removeRegistration(values.groupId, values.registrationId);

    return this.findById(values.championshipId, values.groupId);
  }

  async moveRegistration(championshipId, groupId, registrationId, input = {}, context = {}) {
    const values = validateChampionshipGroupMoveInput(
      championshipId,
      groupId,
      registrationId,
      input,
    );
    await this.requireGroup(values.championshipId, values.groupId);
    await this.requireGroup(values.championshipId, values.targetGroupId);
    await this.requireActiveRegistration(values.championshipId, values.registrationId);
    await this.requireAssignment(values.championshipId, values.groupId, values.registrationId);

    const drawPosition =
      values.drawPosition === null
        ? await this.getNextDrawPosition(values.targetGroupId)
        : values.drawPosition;
    await this.getGroupRepository().moveRegistration({
      drawPosition,
      registrationId: values.registrationId,
      targetGroupId: values.targetGroupId,
      updatedBy: readActor(context),
    });

    return this.findById(values.championshipId, values.targetGroupId);
  }

  async drawGroups(championshipId, input = {}, context = {}) {
    const values = validateChampionshipGroupDrawInput(championshipId, input);
    await this.requireChampionship(values.championshipId);

    const existingAssignments = await this.getGroupRepository().listAssignmentsByChampionship(
      values.championshipId,
    );

    if (existingAssignments.length > 0) {
      throw controlledError(
        "O campeonato ja possui equipes em grupos. Use redistribuir para refazer.",
        GROUP_DRAW_ALREADY_HAS_ASSIGNMENTS_CODE,
        409,
        { championshipId: values.championshipId },
      );
    }

    return this.distribute(values.championshipId, values, context);
  }

  async redistributeGroups(championshipId, input = {}, context = {}) {
    const values = validateChampionshipGroupDrawInput(championshipId, input);
    await this.requireChampionship(values.championshipId);
    return this.distribute(values.championshipId, values, context);
  }

  async distribute(championshipId, values = {}, context = {}) {
    const activeRegistrations = await this.findActiveRegistrations(championshipId);
    const groups = await this.ensureDrawGroups(
      championshipId,
      values.groupCount || Math.max(1, Math.min(activeRegistrations.length || 1, 4)),
      context,
    );
    const orderedGroups = groups
      .slice()
      .sort(
        (left, right) =>
          left.displayOrder - right.displayOrder || left.name.localeCompare(right.name),
      );
    const registrations = values.shuffle
      ? deterministicShuffle(activeRegistrations, championshipId)
      : activeRegistrations;
    const assignments = registrations.map((registration, index) => {
      const group = orderedGroups[index % orderedGroups.length];
      return {
        drawPosition: Math.floor(index / orderedGroups.length) + 1,
        groupId: group.id,
        registrationId: readRegistrationField(registration, "id"),
      };
    });

    await this.getGroupRepository().replaceAssignments(championshipId, assignments);
    return this.findAll(championshipId, { limit: 100, sortBy: "displayOrder" });
  }

  async ensureDrawGroups(championshipId, groupCount, context = {}) {
    const safeCount = Math.max(1, Math.min(Number(groupCount) || 1, 64));
    const current = await this.getGroupRepository().findAllByChampionship({
      championshipId,
      limit: 100,
      page: 1,
      sortBy: "displayOrder",
      sortDirection: "ASC",
    });
    const groups = Array.isArray(current?.items) ? current.items.slice() : [];

    while (groups.length < safeCount) {
      const index = groups.length;
      const group = await this.getGroupRepository().create({
        championshipId,
        createdBy: readActor(context),
        displayOrder: index + 1,
        name: createDefaultGroupName(index),
        updatedBy: readActor(context),
      });
      groups.push(group);
    }

    return groups
      .slice(0, safeCount)
      .sort(
        (left, right) =>
          left.displayOrder - right.displayOrder || left.name.localeCompare(right.name),
      );
  }

  async findActiveRegistrations(championshipId) {
    const repository = this.getRegistrationRepository();
    const items = [];
    let page = 1;
    const limit = 100;

    while (page <= 20) {
      const result = await repository.findAll({
        championshipId,
        limit,
        page,
        sortBy: "teamName",
        sortDirection: "ASC",
      });
      const pageItems = Array.isArray(result?.items) ? result.items : result || [];
      items.push(...pageItems);

      const total = Number(result?.total || pageItems.length);
      if (page * limit >= total || pageItems.length === 0) break;
      page += 1;
    }

    return items.filter((registration) =>
      ACTIVE_REGISTRATION_STATUSES.has(readRegistrationField(registration, "status")),
    );
  }

  async requireChampionship(championshipId) {
    if (!this.championshipRepository) {
      throw controlledError(
        "ChampionshipRepository nao configurado para grupos.",
        GROUP_CHAMPIONSHIP_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    const championship = await this.championshipRepository.findById(championshipId);

    if (!championship) {
      throw controlledError(
        "Campeonato nao encontrado para grupos.",
        GROUP_CHAMPIONSHIP_NOT_FOUND_CODE,
        404,
        { championshipId },
      );
    }

    return championship;
  }

  async requireGroup(championshipId, groupId) {
    const group = await this.getGroupRepository().findById(championshipId, groupId);

    if (!group) {
      throw controlledError("Grupo nao encontrado.", GROUP_NOT_FOUND_CODE, 404, {
        championshipId,
        groupId,
      });
    }

    return group;
  }

  async requireActiveRegistration(championshipId, registrationId) {
    const registration = await this.getRegistrationRepository().findById(registrationId);

    if (!registration) {
      throw controlledError(
        "Inscricao nao encontrada para grupo.",
        GROUP_REGISTRATION_NOT_FOUND_CODE,
        404,
        { registrationId },
      );
    }

    if (readRegistrationField(registration, "championshipId") !== championshipId) {
      throw controlledError(
        "Inscricao nao pertence ao campeonato informado.",
        GROUP_REGISTRATION_NOT_FOUND_CODE,
        404,
        { championshipId, registrationId },
      );
    }

    const status = readRegistrationField(registration, "status");

    if (status === RegistrationStatus.CANCELLED) {
      throw controlledError(
        "Inscricao cancelada nao pode ser adicionada a grupos.",
        GROUP_REGISTRATION_CANCELLED_CODE,
        409,
        { registrationId, status },
      );
    }

    if (!ACTIVE_REGISTRATION_STATUSES.has(status)) {
      throw controlledError(
        "Apenas inscricoes pendentes ou confirmadas podem compor grupos.",
        GROUP_REGISTRATION_INACTIVE_CODE,
        409,
        { registrationId, status },
      );
    }

    return registration;
  }

  async ensureRegistrationNotAssigned(championshipId, registrationId) {
    const assignment = await this.getGroupRepository().findAssignmentByRegistration(
      championshipId,
      registrationId,
    );

    if (assignment) {
      throw controlledError(
        "Equipe inscrita ja esta vinculada a um grupo.",
        GROUP_REGISTRATION_ALREADY_ASSIGNED_CODE,
        409,
        { groupId: assignment.groupId, registrationId },
      );
    }
  }

  async requireAssignment(championshipId, groupId, registrationId) {
    const assignment = await this.getGroupRepository().findAssignmentByRegistration(
      championshipId,
      registrationId,
    );

    if (!assignment || assignment.groupId !== groupId) {
      throw controlledError(
        "Equipe nao encontrada neste grupo.",
        GROUP_ASSIGNMENT_NOT_FOUND_CODE,
        404,
        {
          championshipId,
          groupId,
          registrationId,
        },
      );
    }

    return assignment;
  }

  async ensureGroupNameAvailable(championshipId, name, ignoredGroupId = null) {
    const existing = await this.getGroupRepository().findByName(championshipId, name);

    if (existing && readGroupField(existing, "id") !== ignoredGroupId) {
      throw controlledError("Ja existe grupo com este nome.", GROUP_DUPLICATE_NAME_CODE, 409, {
        championshipId,
        name,
      });
    }
  }

  async getNextDisplayOrder(championshipId) {
    const result = await this.getGroupRepository().findAllByChampionship({
      championshipId,
      limit: 100,
      page: 1,
      sortBy: "displayOrder",
      sortDirection: "ASC",
    });
    const items = Array.isArray(result?.items) ? result.items : result || [];
    const maxOrder = items.reduce(
      (max, group) => Math.max(max, Number(readGroupField(group, "displayOrder") || 0)),
      0,
    );

    return maxOrder + 1;
  }

  async getNextDrawPosition(groupId) {
    const total = await this.getGroupRepository().countRegistrations(groupId);
    return total + 1;
  }

  getGroupRepository() {
    if (!this.groupRepository) {
      throw controlledError(
        "ChampionshipGroupRepository nao configurado.",
        GROUP_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.groupRepository;
  }

  getRegistrationRepository() {
    if (!this.registrationRepository) {
      throw controlledError(
        "ChampionshipRegistrationRepository nao configurado para grupos.",
        GROUP_REGISTRATION_REPOSITORY_REQUIRED_CODE,
        500,
      );
    }

    return this.registrationRepository;
  }
}

function createDefaultGroupName(index) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return index < alphabet.length ? `Grupo ${alphabet[index]}` : `Grupo ${index + 1}`;
}

function deterministicShuffle(items, seed) {
  return items
    .map((item, index) => ({
      index,
      item,
      weight: hashValue(`${seed}:${readRegistrationField(item, "id")}:${index}`),
    }))
    .sort((left, right) => left.weight - right.weight || left.index - right.index)
    .map((entry) => entry.item);
}

function hashValue(value) {
  let hash = 0;
  const textValue = String(value || "");

  for (let index = 0; index < textValue.length; index += 1) {
    hash = (hash * 31 + textValue.charCodeAt(index)) % 1000003;
  }

  return hash;
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

function readGroupField(group, fieldName) {
  return group?.[fieldName] ?? group?.toJSON?.()?.[fieldName] ?? null;
}

function readRegistrationField(registration, fieldName) {
  return registration?.[fieldName] ?? registration?.toJSON?.()?.[fieldName] ?? null;
}

module.exports = {
  ChampionshipGroupService,
  GROUP_ASSIGNMENT_NOT_FOUND_CODE,
  GROUP_DRAW_ALREADY_HAS_ASSIGNMENTS_CODE,
  GROUP_DUPLICATE_NAME_CODE,
  GROUP_NOT_EMPTY_CODE,
  GROUP_NOT_FOUND_CODE,
  GROUP_REGISTRATION_ALREADY_ASSIGNED_CODE,
  GROUP_REGISTRATION_CANCELLED_CODE,
  GROUP_REGISTRATION_INACTIVE_CODE,
  GROUP_REGISTRATION_NOT_FOUND_CODE,
};
