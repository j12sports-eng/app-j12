const CLASS_INPUT_REQUIRED_CODE = "CLASS_INPUT_REQUIRED";
const CLASS_NOT_FOUND_CODE = "CLASS_NOT_FOUND";
const CLASS_INACTIVE_CODE = "CLASS_INACTIVE";
const CLASS_CAPACITY_UNCONFIGURED_CODE = "CLASS_CAPACITY_UNCONFIGURED";
const CLASS_CAPACITY_FULL_CODE = "CLASS_CAPACITY_FULL";
const CLASS_CAPACITY_OVERBOOKED_CODE = "CLASS_CAPACITY_OVERBOOKED";

/**
 * Application service for read-only Classes/Turmas use cases.
 *
 * The service exposes a stable domain boundary for future modules without
 * changing current Turmas routes or frontend behavior.
 */
class ClassApplicationService {
  /**
   * @param {Object} [options]
   * @param {import("../repositories/class.repository.js").ClassRepository} [options.classRepository]
   */
  constructor({ classRepository = null } = {}) {
    this.classRepository = classRepository;
  }

  /**
   * @param {{ classId?: string|number|null }} [input]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findClassById(input = {}) {
    const classId = normalizeClassId(input.classId);

    if (!classId) {
      return null;
    }

    return this.getClassRepository().findById({ classId });
  }

  /**
   * @param {{ classId?: string|number|null }} [input]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async findActiveClassById(input = {}) {
    const classId = normalizeClassId(input.classId);

    if (!classId) {
      return null;
    }

    const repository = this.getClassRepository();

    if (typeof repository.findActiveById === "function") {
      return repository.findActiveById({ classId });
    }

    const classRecord = await repository.findById({ classId });
    return isActiveClass(classRecord) ? classRecord : null;
  }

  /**
   * @param {{ classId?: string|number|null }} [input]
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async getClassCapacitySummary(input = {}) {
    const classId = normalizeClassId(input.classId);

    if (!classId) {
      return null;
    }

    const repository = this.getClassRepository();
    const snapshot =
      typeof repository.getClassCapacitySnapshot === "function"
        ? await repository.getClassCapacitySnapshot(readCapacitySnapshotInput(input, classId))
        : null;
    const classRecord = snapshot?.classRecord || (await repository.findById({ classId }));

    if (!classRecord) {
      return null;
    }

    return buildCapacitySummary({
      classId,
      classRecord,
      snapshot,
    });
  }

  /**
   * @param {{ classId?: string|number|null }} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async ensureClassHasAvailableCapacity(input = {}) {
    const classId = normalizeClassId(input.classId);

    if (!classId) {
      throw controlledError("Class id is required.", CLASS_INPUT_REQUIRED_CODE, { classId });
    }

    const repository = this.getClassRepository();
    const snapshot =
      typeof repository.getClassCapacitySnapshot === "function"
        ? await repository.getClassCapacitySnapshot(readCapacitySnapshotInput(input, classId))
        : null;
    const classRecord = snapshot?.classRecord || (await repository.findById({ classId }));

    if (!classRecord) {
      throw controlledError("Class was not found.", CLASS_NOT_FOUND_CODE, { classId });
    }

    if (!isActiveClass(classRecord)) {
      throw controlledError("Class is inactive.", CLASS_INACTIVE_CODE, { classId });
    }

    const summary = buildCapacitySummary({
      classId,
      classRecord,
      snapshot,
    });

    if (!summary.capacityConfigured || summary.capacityTotal == null) {
      throw controlledError(
        "Class capacity is not configured.",
        CLASS_CAPACITY_UNCONFIGURED_CODE,
        { classId },
      );
    }

    if (!summary.hasAvailableCapacity) {
      throw controlledError(
        "Class has no available capacity.",
        CLASS_CAPACITY_FULL_CODE,
        {
          classId,
          capacityTotal: summary.capacityTotal,
          occupiedSlots: summary.occupiedSlots,
        },
      );
    }

    return summary;
  }

  /**
   * @param {{ classId?: string|number|null, lockForUpdate?: boolean, occupancySource?: string|null }} [input]
   * @returns {Promise<Record<string, unknown>>}
   */
  async ensureClassOccupancyWithinCapacity(input = {}) {
    const classId = normalizeClassId(input.classId);

    if (!classId) {
      throw controlledError("Class id is required.", CLASS_INPUT_REQUIRED_CODE, { classId });
    }

    const repository = this.getClassRepository();
    const snapshot =
      typeof repository.getClassCapacitySnapshot === "function"
        ? await repository.getClassCapacitySnapshot(readCapacitySnapshotInput(input, classId))
        : null;
    const classRecord = snapshot?.classRecord || (await repository.findById({ classId }));

    if (!classRecord) {
      throw controlledError("Class was not found.", CLASS_NOT_FOUND_CODE, { classId });
    }

    if (!isActiveClass(classRecord)) {
      throw controlledError("Class is inactive.", CLASS_INACTIVE_CODE, { classId });
    }

    const summary = buildCapacitySummary({
      classId,
      classRecord,
      snapshot,
    });

    if (!summary.capacityConfigured || summary.capacityTotal == null) {
      throw controlledError(
        "Class capacity is not configured.",
        CLASS_CAPACITY_UNCONFIGURED_CODE,
        { classId },
      );
    }

    if (
      Number.isInteger(summary.occupiedSlots) &&
      Number.isInteger(summary.capacityTotal) &&
      summary.occupiedSlots > summary.capacityTotal
    ) {
      throw controlledError(
        "Class occupancy exceeds configured capacity.",
        CLASS_CAPACITY_OVERBOOKED_CODE,
        {
          classId,
          capacityTotal: summary.capacityTotal,
          occupiedSlots: summary.occupiedSlots,
        },
      );
    }

    return {
      ...summary,
      occupancyConsistent: true,
    };
  }

  /**
   * @returns {import("../repositories/class.repository.js").ClassRepository}
   */
  getClassRepository() {
    const repository = this.classRepository;

    if (!repository || typeof repository !== "object") {
      throw controlledError(
        "ClassApplicationService requires a classRepository.",
        CLASS_INPUT_REQUIRED_CODE,
      );
    }

    if (typeof repository.findById !== "function") {
      throw controlledError(
        "ClassApplicationService requires a classRepository.findById function.",
        CLASS_INPUT_REQUIRED_CODE,
      );
    }

    return repository;
  }
}

/**
 * @param {Record<string, unknown>|null} classRecord
 * @returns {boolean}
 */
function isActiveClass(classRecord) {
  if (!classRecord || typeof classRecord !== "object") {
    return false;
  }

  const normalized = nullableText(readFirstDefined(classRecord, ["status"]), 32)?.toLowerCase();

  if (["inativa", "inativo", "inactive", "false", "0"].includes(normalized || "")) {
    return false;
  }

  return true;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeClassId(value) {
  const parsed = Number(String(value ?? "").trim());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.trunc(parsed);
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeOptionalInteger(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.trunc(parsed));
}

/**
 * @param {Record<string, unknown>} source
 * @param {string[]} keys
 * @returns {unknown}
 */
function readFirstDefined(source, keys) {
  for (const key of keys) {
    if (source?.[key] != null) {
      return source[key];
    }
  }

  return null;
}

/**
 * @param {Record<string, unknown>} input
 * @param {number} classId
 * @returns {{ classId: number, lockForUpdate: boolean, occupancySource: string|null }}
 */
function readCapacitySnapshotInput(input = {}, classId) {
  return {
    classId,
    lockForUpdate: input.lockForUpdate === true,
    occupancySource: nullableText(input.occupancySource, 64),
  };
}

/**
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string|null}
 */
function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

/**
 * @param {string} message
 * @param {string} code
 * @returns {Error}
 */
function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

/**
 * @param {{ classId: number, classRecord: Record<string, unknown>, snapshot?: Record<string, unknown>|null }} input
 * @returns {Record<string, unknown>}
 */
function buildCapacitySummary({ classId, classRecord, snapshot = null }) {
  const capacity = normalizeOptionalInteger(
    snapshot?.capacity ?? readFirstDefined(classRecord, ["capacity", "capacidade"]),
  );
  const currentStudentCount = normalizeOptionalInteger(
    snapshot?.currentStudentCount ??
      snapshot?.studentCount ??
      readFirstDefined(classRecord, ["currentStudentCount", "studentCount", "alunoCount"]),
  );
  const capacityConfigured = Number.isInteger(capacity) && capacity > 0;
  const availableCapacity =
    capacityConfigured && Number.isInteger(currentStudentCount)
      ? Math.max(capacity - currentStudentCount, 0)
      : null;
  const occupiedSlots = Number.isInteger(currentStudentCount) ? currentStudentCount : null;
  const availableSlots = Number.isInteger(availableCapacity) ? availableCapacity : null;
  const hasAvailableCapacity =
    capacityConfigured && Number.isInteger(currentStudentCount)
      ? currentStudentCount < capacity
      : false;

  return {
    active: isActiveClass(classRecord),
    availableCapacity,
    availableSlots,
    capacity,
    capacityConfigured,
    capacitySource:
      nullableText(snapshot?.capacitySource, 191) ||
      "j12_turmas.capacidade + active j12_alunos links",
    capacityTotal: capacity,
    classId,
    className: nullableText(readFirstDefined(classRecord, ["name", "nome"]), 191),
    currentStudentCount,
    full:
      capacityConfigured && Number.isInteger(currentStudentCount)
        ? currentStudentCount >= capacity
        : false,
    hasAvailableCapacity,
    occupiedSlots,
    source: {
      capacityField: "j12_turmas.capacidade",
      studentCountSource:
        nullableText(snapshot?.studentCountSource, 191) ||
        "j12_alunos.turma_id OR j12_alunos.turma_principal",
    },
    status: nullableText(readFirstDefined(classRecord, ["status"]), 32),
  };
}

module.exports = {
  CLASS_CAPACITY_OVERBOOKED_CODE,
  CLASS_INPUT_REQUIRED_CODE,
  ClassApplicationService,
  isActiveClass,
  normalizeClassId,
  normalizeOptionalInteger,
};
