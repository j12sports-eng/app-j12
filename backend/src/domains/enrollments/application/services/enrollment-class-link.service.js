const {
  EnrollmentStatus,
  normalizeEnrollmentStatus,
} = require("../../domain/enums/enrollment-status.enum.js");
const {
  ENROLLMENT_CLASS_LINK_INVALID_CLASS_ID_CODE,
  ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS_CODE,
  ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS_CODE,
  prepareEnrollmentClassLink,
} = require("../contracts/enrollment-class-link.contract.js");

const ENROLLMENT_CLASS_LINK_INPUT_REQUIRED_CODE = "ENROLLMENT_CLASS_LINK_INPUT_REQUIRED";
const ENROLLMENT_CLASS_LINK_ENROLLMENT_NOT_FOUND_CODE =
  "ENROLLMENT_CLASS_LINK_ENROLLMENT_NOT_FOUND";
const ENROLLMENT_CLASS_LINK_CLASS_NOT_FOUND_CODE = "ENROLLMENT_CLASS_LINK_CLASS_NOT_FOUND";
const ENROLLMENT_CLASS_LINK_CLASS_FULL_CODE = "ENROLLMENT_CLASS_LINK_CLASS_FULL";
const ENROLLMENT_CLASS_LINK_CLASS_CAPACITY_UNCONFIGURED_CODE =
  "ENROLLMENT_CLASS_LINK_CLASS_CAPACITY_UNCONFIGURED";
const ENROLLMENT_CLASS_LINK_DUPLICATE_CODE = "ENROLLMENT_CLASS_LINK_DUPLICATE";

/**
 * Internal service for Enrollment -> Turma integration.
 *
 * The preparation method remains no-write for legacy callers. The persistence
 * method creates or reuses a row in enrollment_class_links after validating an
 * ACTIVE Enrollment and a Turma provided by the injected Turmas reader. This
 * service does not mutate Turmas, Financeiro, Agenda or Notificacoes.
 */
class EnrollmentClassLinkService {
  /**
   * @param {Object} [options]
   * @param {{ findEnrollmentById?: (id: string) => Promise<unknown|null>, findById?: (id: string) => Promise<unknown|null> }} [options.enrollmentReader]
   * @param {{ findActiveClassById?: (input: Record<string, unknown>) => Promise<unknown|null>, ensureClassHasAvailableCapacity?: (input: Record<string, unknown>) => Promise<Record<string, unknown>>, findClassById?: (input: Record<string, unknown>) => Promise<unknown|null> }} [options.classFacade]
   * @param {{ findClassById?: (id: string|number) => Promise<unknown|null>, findById?: (id: string|number) => Promise<unknown|null>, findExistingEnrollmentClassLink?: (input: Record<string, unknown>) => Promise<unknown|null> }} [options.classReader]
   * @param {(work: (context?: { classFacade?: unknown, classLinkRepository?: unknown, classReader?: unknown, enrollmentReader?: unknown }) => Promise<unknown>) => Promise<unknown>} [options.transactionRunner]
   */
  constructor({
    classFacade = null,
    classLinkRepository = null,
    classReader = null,
    enrollmentReader = null,
    transactionRunner = null,
  } = {}) {
    this.classFacade = classFacade;
    this.classLinkRepository = classLinkRepository;
    this.classReader = classReader;
    this.enrollmentReader = enrollmentReader;
    this.transactionRunner = typeof transactionRunner === "function" ? transactionRunner : null;
  }

  /**
   * Prepares an Enrollment -> Turma link after validating the persisted
   * Enrollment. No link is persisted by this sprint.
   *
   * @param {Object} input
   * @param {string|null} [input.enrollmentId]
   * @param {string|null} [input.classId]
   * @param {string|null} [input.turmaId]
   * @param {string|null} [input.requestedBy]
   * @param {Record<string, unknown>} [input.metadata]
   * @returns {Promise<Record<string, unknown>>}
   */
  async prepareActiveEnrollmentClassLink(input = {}) {
    const enrollmentId = nullableText(input.enrollmentId, 64);
    const classId = nullableText(input.classId ?? input.turmaId, 64);
    const requestedBy = nullableText(input.requestedBy, 191);

    if (!enrollmentId || !classId || !requestedBy) {
      throw controlledError(
        "prepareActiveEnrollmentClassLink requires enrollmentId, classId and requestedBy.",
        ENROLLMENT_CLASS_LINK_INPUT_REQUIRED_CODE,
        {
          hasClassId: Boolean(classId),
          hasEnrollmentId: Boolean(enrollmentId),
          hasRequestedBy: Boolean(requestedBy),
        },
      );
    }

    const enrollment = await this.findEnrollmentById(enrollmentId);

    if (!enrollment) {
      throw controlledError(
        "Enrollment was not found for class link preparation.",
        ENROLLMENT_CLASS_LINK_ENROLLMENT_NOT_FOUND_CODE,
        { enrollmentId },
      );
    }

    const enrollmentStatus = normalizeEnrollmentStatus(readProperty(enrollment, "status"));

    if (enrollmentStatus !== EnrollmentStatus.ACTIVE) {
      throw controlledError(
        "Only ACTIVE Enrollment can prepare a class link.",
        ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS_CODE,
        {
          enrollmentId,
          enrollmentStatus,
          requiredEnrollmentStatus: EnrollmentStatus.ACTIVE,
        },
      );
    }

    const classValidation = await this.validateClassReadiness({
      classId,
      enrollmentId,
    });
    const studentPersonId = readStudentId(enrollment, input, [
      "studentPersonId",
      "student_person_id",
    ]);
    const studentProfileId = readStudentId(enrollment, input, [
      "studentProfileId",
      "student_profile_id",
    ]);
    const contract = prepareEnrollmentClassLink({
      ...input,
      classId,
      classStatus: classValidation.classStatus || input.classStatus,
      enrollmentId,
      enrollmentStatus,
      metadata: {
        operation: "prepareActiveEnrollmentClassLink",
        ...readObject(input.metadata),
      },
      requestedBy,
    });

    return {
      ...contract,
      auditActionPrepared: "CLASS_LINK_CREATED",
      auditRecorded: false,
      classIntegrationBlocked: true,
      classValidation,
      duplicateLinkBlockedByNoWrite: !classValidation.duplicateCheckAvailable,
      enrollmentFound: true,
      enrollmentSnapshot: {
        id: enrollmentId,
        status: enrollmentStatus,
        studentPersonId,
        studentProfileId,
      },
      eventDispatched: false,
      eventPrepared: "EnrollmentClassLinked",
      linkCreationBlockedBySchemaOrModuleGap: true,
      noFinancialSideEffects: true,
      noNotificationSideEffects: true,
      noScheduleSideEffects: true,
      officialFlowStillWorking: true,
      personToClassFlowPrepared: true,
      safeToRetry: true,
    };
  }

  /**
   * Persists an ACTIVE enrollment -> class link after validating readiness.
   *
   * @param {Object} input
   * @param {string|null} [input.enrollmentId]
   * @param {string|null} [input.classId]
   * @param {string|null} [input.turmaId]
   * @param {string|null} [input.linkedBy]
   * @returns {Promise<Record<string, unknown>>}
   */
  async linkActiveEnrollmentToClass(input = {}) {
    const enrollmentId = nullableText(input.enrollmentId, 64);
    const classId = normalizeClassIdInput(input.classId ?? input.turmaId);
    const linkedBy = nullableText(input.linkedBy, 191);
    const transactionUsed = Boolean(this.transactionRunner);

    if (!enrollmentId || !classId || !linkedBy) {
      throw controlledError(
        "linkActiveEnrollmentToClass requires enrollmentId, classId and linkedBy.",
        ENROLLMENT_CLASS_LINK_INPUT_REQUIRED_CODE,
        {
          hasClassId: Boolean(classId),
          hasEnrollmentId: Boolean(enrollmentId),
          hasLinkedBy: Boolean(linkedBy),
        },
      );
    }

    return this.runLinkTransaction(async (transactionContext = {}) => {
      const classFacade = transactionContext.classFacade || this.classFacade;
      const enrollmentReader = transactionContext.enrollmentReader || this.enrollmentReader;
      const classReader = transactionContext.classReader || this.classReader;
      const classLinkRepository =
        transactionContext.classLinkRepository || this.classLinkRepository;
      const capacityTransaction = readCapacityTransactionOptions({
        classFacade,
        transactionContext,
        transactionUsed,
      });
      const enrollment = await this.findEnrollmentById(enrollmentId, enrollmentReader);

      if (!enrollment) {
        throw controlledError(
          "Enrollment was not found for class link persistence.",
          ENROLLMENT_CLASS_LINK_ENROLLMENT_NOT_FOUND_CODE,
          { enrollmentId },
        );
      }

      const enrollmentStatus = normalizeEnrollmentStatus(readProperty(enrollment, "status"));

      if (enrollmentStatus !== EnrollmentStatus.ACTIVE) {
        throw controlledError(
          "Only ACTIVE Enrollment can be linked to a class.",
          ENROLLMENT_CLASS_LINK_INVALID_ENROLLMENT_STATUS_CODE,
          {
            enrollmentId,
            enrollmentStatus,
            requiredEnrollmentStatus: EnrollmentStatus.ACTIVE,
          },
        );
      }

      const existingLink = await this.findActiveEnrollmentClassLink(
        {
          classId,
          enrollmentId,
        },
        classLinkRepository,
      );

      if (existingLink) {
        const classValidation = await this.validateClassReadiness(
          {
            capacityMode: "occupancy",
            classId,
            enrollmentId,
            checkDuplicate: false,
            lockForUpdate: capacityTransaction.lockForUpdate,
            occupancySource: capacityTransaction.occupancySource,
            requireClassReader: true,
          },
          {
            classLinkRepository,
            classFacade,
            classReader,
          },
        );
        const capacityRecheck = buildClassCapacityTransactionResult({
          capacityTransaction,
          recheck: classValidation.capacitySummary || classValidation,
        });

        return {
          classCapacityTransaction: capacityRecheck,
          classValidation,
          created: false,
          enrollmentFound: true,
          link: existingLink,
          linkAudit: readLinkAudit(existingLink, linkedBy),
          linkAuditPersisted: hasLinkAudit(existingLink, linkedBy),
          noFinancialSideEffects: true,
          noNotificationSideEffects: true,
          noScheduleSideEffects: true,
          officialFlowStillWorking: true,
          persisted: true,
          reused: true,
          transactional: transactionUsed,
        };
      }

      const classValidation = await this.validateClassReadiness(
        {
          capacityMode: "availability",
          classId,
          enrollmentId,
          checkDuplicate: false,
          lockForUpdate: capacityTransaction.lockForUpdate,
          occupancySource: capacityTransaction.occupancySource,
          requireClassReader: true,
        },
        {
          classLinkRepository,
          classFacade,
          classReader,
        },
      );

      const repository = this.getClassLinkRepository(classLinkRepository);
      const createInput = {
        classId,
        enrollmentId,
        linkedBy,
      };
      const metadata = readObject(input.metadata);
      const origin = nullableText(input.origin, 50);

      if (Object.keys(metadata).length > 0) {
        createInput.metadata = metadata;
      }

      if (origin) {
        createInput.origin = origin;
      }

      const persistenceResult = await this.createActiveEnrollmentClassLink(repository, createInput);
      const link = readProperty(persistenceResult, "link") || persistenceResult;
      const capacityRecheck = await this.recheckClassOccupancyAfterLink({
        capacityTransaction,
        classFacade,
        classId,
      });

      return {
        classCapacityTransaction: buildClassCapacityTransactionResult({
          capacityTransaction,
          recheck: capacityRecheck,
        }),
        classValidation,
        created: readBooleanProperty(persistenceResult, "created", true),
        enrollmentFound: true,
        link,
        linkAudit: readLinkAudit(link, linkedBy),
        linkAuditPersisted: hasLinkAudit(link, linkedBy),
        noFinancialSideEffects: true,
        noNotificationSideEffects: true,
        noScheduleSideEffects: true,
        officialFlowStillWorking: true,
        persisted: true,
        reused: readBooleanProperty(persistenceResult, "reused", false),
        transactional: transactionUsed,
      };
    });
  }

  /**
   * @param {string} enrollmentId
   * @returns {Promise<unknown|null>}
   */
  async findEnrollmentById(enrollmentId, enrollmentReader = this.enrollmentReader) {
    const reader = this.getEnrollmentReader(enrollmentReader);

    if (typeof reader.findEnrollmentById === "function") {
      return reader.findEnrollmentById(enrollmentId);
    }

    return reader.findById(enrollmentId);
  }

  /**
   * @returns {{ findEnrollmentById?: (id: string) => Promise<unknown|null>, findById?: (id: string) => Promise<unknown|null> }}
   */
  getEnrollmentReader(enrollmentReader = this.enrollmentReader) {
    if (
      !enrollmentReader ||
      (
        typeof enrollmentReader.findEnrollmentById !== "function" &&
        typeof enrollmentReader.findById !== "function"
      )
    ) {
      throw new TypeError(
        "EnrollmentClassLinkService requires an enrollmentReader.findEnrollmentById or findById function.",
      );
    }

    return enrollmentReader;
  }

  /**
   * @param {{ capacityMode?: "availability"|"occupancy", classId: string|number, enrollmentId: string, checkDuplicate?: boolean, lockForUpdate?: boolean, occupancySource?: string|null, requireClassReader?: boolean }} input
   * @param {{ classFacade?: unknown, classLinkRepository?: unknown, classReader?: unknown }} [dependencies]
   * @returns {Promise<Record<string, unknown>>}
   */
  async validateClassReadiness(
    {
      capacityMode = "availability",
      classId,
      enrollmentId,
      checkDuplicate = true,
      lockForUpdate = false,
      occupancySource = null,
      requireClassReader = false,
    },
    dependencies = {},
  ) {
    if (!isValidClassIdValue(classId)) {
      throw controlledError(
        "prepareActiveEnrollmentClassLink requires a numeric classId compatible with j12_turmas.id.",
        ENROLLMENT_CLASS_LINK_INVALID_CLASS_ID_CODE,
        { classId },
      );
    }

    const classFacade = dependencies.classFacade || this.classFacade;
    const classLinkRepository = dependencies.classLinkRepository || this.classLinkRepository;

    if (classFacade) {
      return this.validateClassReadinessWithFacade(
        {
          capacityMode,
          checkDuplicate,
          classId,
          enrollmentId,
          lockForUpdate,
          occupancySource,
        },
        {
          classFacade,
          classLinkRepository,
        },
      );
    }

    const classReader = dependencies.classReader || this.classReader;

    if (!classReader) {
      if (requireClassReader) {
        throw controlledError(
          "ClassFacade is required before an Enrollment class link can be persisted.",
          ENROLLMENT_CLASS_LINK_CLASS_NOT_FOUND_CODE,
          {
            classId,
            classFacadeAvailable: false,
            classReaderAvailable: false,
            enrollmentId,
          },
        );
      }

      return {
        capacityAvailable: null,
        capacityChecked: false,
        classFacadeAvailable: false,
        classFound: null,
        classId,
        classReaderAvailable: false,
        classStatus: null,
        duplicateCheckAvailable: false,
        duplicateLinkFound: null,
        mappedLegacyClassModule: true,
        reason: "No safe Turmas facade/service is available for real persistence.",
      };
    }

    const turma = await this.findClassById(classId, classReader);

    if (!turma) {
      throw controlledError(
        "Class was not found for Enrollment class link preparation.",
        ENROLLMENT_CLASS_LINK_CLASS_NOT_FOUND_CODE,
        { classId },
      );
    }

    const classStatus = readClassStatus(turma);

    if (classStatus !== "ativa") {
      throw controlledError(
        "Class must be active before an Enrollment class link can be prepared.",
        ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS_CODE,
        {
          classId,
          classStatus,
          requiredClassStatus: "ativa",
        },
      );
    }

    const capacitySnapshot = await this.getClassCapacitySnapshot({ classId }, classLinkRepository);
    const capacity = capacitySnapshot?.capacity ?? readCapacity(turma);
    const currentStudents = capacitySnapshot
      ? normalizeCount(capacitySnapshot.activeLinkCount)
      : readCurrentStudents(turma).length;
    const capacityChecked = capacity !== null;
    const explicitAvailableCapacity = capacitySnapshot?.availableCapacity ?? null;
    const capacityAvailable = explicitAvailableCapacity !== null
      ? Number(explicitAvailableCapacity) > 0
      : capacityChecked
        ? currentStudents < capacity
        : null;
    const occupancyConsistent = capacityChecked ? currentStudents <= capacity : null;

    if (
      (capacityMode === "occupancy" && occupancyConsistent === false) ||
      (capacityMode !== "occupancy" && capacityAvailable === false)
    ) {
      throw controlledError(
        "Class has no available capacity for Enrollment class link preparation.",
        ENROLLMENT_CLASS_LINK_CLASS_FULL_CODE,
        {
          activeLinkCount: capacitySnapshot?.activeLinkCount ?? currentStudents,
          capacity,
          classId,
          currentStudents: capacitySnapshot?.activeLinkCount ?? currentStudents,
        },
      );
    }

    if (checkDuplicate) {
      const duplicateLink = await this.findExistingEnrollmentClassLink(
        {
          classId,
          enrollmentId,
        },
        classReader,
      );

      if (duplicateLink) {
        throw controlledError(
          "Enrollment is already linked to this class.",
          ENROLLMENT_CLASS_LINK_DUPLICATE_CODE,
          {
            classId,
            duplicateLink,
            enrollmentId,
          },
        );
      }
    }

    return {
      capacity,
      capacityAvailable,
      capacityChecked,
      capacityMode,
      classFacadeAvailable: false,
      classFound: true,
      classId,
      classReaderAvailable: true,
      classStatus,
      currentStudents,
      duplicateCheckAvailable: typeof classReader.findExistingEnrollmentClassLink === "function",
      duplicateLinkFound: false,
      mappedLegacyClassModule: true,
      name: nullableText(readProperty(turma, "nome") ?? readProperty(turma, "name"), 191),
      occupancyConsistent,
    };
  }

  /**
   * Validates Turma existence, active status and capacity through the official
   * Classes facade. Enrollment keeps only the enrollment/link-specific guards.
   *
   * @param {{ capacityMode?: "availability"|"occupancy", classId: string|number, enrollmentId: string, checkDuplicate?: boolean, lockForUpdate?: boolean, occupancySource?: string|null }} input
   * @param {{ classFacade?: unknown, classLinkRepository?: unknown }} dependencies
   * @returns {Promise<Record<string, unknown>>}
   */
  async validateClassReadinessWithFacade(
    {
      capacityMode = "availability",
      classId,
      enrollmentId,
      checkDuplicate = true,
      lockForUpdate = false,
      occupancySource = null,
    },
    { classFacade = this.classFacade, classLinkRepository = this.classLinkRepository } = {},
  ) {
    const facade = this.getClassFacade(classFacade);
    const activeClass = await facade.findActiveClassById({ classId });

    if (!activeClass) {
      const classRecord = await this.findClassByIdThroughFacade(classId, facade);

      if (classRecord) {
        throw controlledError(
          "Class must be active before an Enrollment class link can be prepared.",
          ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS_CODE,
          {
            classId,
            classStatus: readClassStatus(classRecord),
            requiredClassStatus: "ativa",
          },
        );
      }

      throw controlledError(
        "Class was not found for Enrollment class link preparation.",
        ENROLLMENT_CLASS_LINK_CLASS_NOT_FOUND_CODE,
        { classId },
      );
    }

    let capacitySummary;

    try {
      const capacityInput = {
        classId,
      };
      const normalizedOccupancySource = nullableText(occupancySource, 64);

      if (lockForUpdate === true) {
        capacityInput.lockForUpdate = true;
      }

      if (normalizedOccupancySource) {
        capacityInput.occupancySource = normalizedOccupancySource;
      }

      capacitySummary =
        capacityMode === "occupancy" &&
        typeof facade.ensureClassOccupancyWithinCapacity === "function"
          ? await facade.ensureClassOccupancyWithinCapacity(capacityInput)
          : await facade.ensureClassHasAvailableCapacity(capacityInput);
    } catch (error) {
      throw mapClassFacadeError(error, {
        classId,
        classRecord: activeClass,
      });
    }

    const duplicateCheckAvailable =
      typeof classLinkRepository?.findActiveByEnrollmentAndClass === "function";

    if (checkDuplicate && duplicateCheckAvailable) {
      const duplicateLink = await this.findActiveEnrollmentClassLink(
        {
          classId,
          enrollmentId,
        },
        classLinkRepository,
      );

      if (duplicateLink) {
        throw controlledError(
          "Enrollment is already linked to this class.",
          ENROLLMENT_CLASS_LINK_DUPLICATE_CODE,
          {
            classId,
            duplicateLink,
            enrollmentId,
          },
        );
      }
    }

    return {
      capacity: readFirstNumber(capacitySummary, ["capacityTotal", "capacity"]),
      capacityAvailable: readCapacityAvailable(capacitySummary),
      capacityChecked: true,
      capacityMode,
      capacitySource: nullableText(readProperty(capacitySummary, "capacitySource"), 191),
      capacitySummary,
      classFacadeAvailable: true,
      classFound: true,
      classId,
      classReaderAvailable: false,
      classStatus: readClassStatus(activeClass),
      classValidatedByFacade: true,
      currentStudents: readFirstNumber(capacitySummary, [
        "occupiedSlots",
        "currentStudentCount",
        "studentCount",
      ]),
      duplicateCheckAvailable,
      duplicateLinkFound: false,
      mappedLegacyClassModule: true,
      name: nullableText(
        readProperty(activeClass, "nome") ||
          readProperty(activeClass, "name") ||
          readProperty(capacitySummary, "className"),
        191,
      ),
      occupancyConsistent: readOccupancyConsistent(capacitySummary),
    };
  }

  /**
   * @param {{ capacityTransaction: Record<string, unknown>, classFacade?: unknown, classId: string|number }} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async recheckClassOccupancyAfterLink({ capacityTransaction, classFacade, classId }) {
    if (typeof classFacade?.ensureClassOccupancyWithinCapacity !== "function") {
      return null;
    }

    try {
      return await classFacade.ensureClassOccupancyWithinCapacity({
        classId,
        ...(capacityTransaction.lockForUpdate === true ? { lockForUpdate: true } : {}),
        ...(capacityTransaction.occupancySource
          ? { occupancySource: capacityTransaction.occupancySource }
          : {}),
      });
    } catch (error) {
      throw mapClassFacadeError(error, { classId });
    }
  }

  /**
   * @param {unknown} classFacade
   * @returns {{ findActiveClassById: Function, ensureClassHasAvailableCapacity: Function, findClassById?: Function }}
   */
  getClassFacade(classFacade = this.classFacade) {
    if (
      !classFacade ||
      typeof classFacade.findActiveClassById !== "function" ||
      typeof classFacade.ensureClassHasAvailableCapacity !== "function"
    ) {
      throw new TypeError(
        "EnrollmentClassLinkService requires a ClassFacade with findActiveClassById and ensureClassHasAvailableCapacity.",
      );
    }

    return classFacade;
  }

  /**
   * @param {string|number} classId
   * @param {{ findClassById?: Function }} classFacade
   * @returns {Promise<unknown|null>}
   */
  async findClassByIdThroughFacade(classId, classFacade = this.classFacade) {
    if (typeof classFacade?.findClassById !== "function") {
      return null;
    }

    return classFacade.findClassById({ classId });
  }

  /**
   * @param {string} classId
   * @returns {Promise<unknown|null>}
   */
  async findClassById(classId, classReader = this.classReader) {
    if (typeof classReader?.findClassById === "function") {
      return classReader.findClassById(classId);
    }

    if (typeof classReader?.findById === "function") {
      return classReader.findById(classId);
    }

    return null;
  }

  /**
   * @param {{ classId: string, enrollmentId: string }} input
   * @returns {Promise<unknown|null>}
   */
  async findExistingEnrollmentClassLink(input, classReader = this.classReader) {
    if (typeof classReader?.findExistingEnrollmentClassLink !== "function") {
      return null;
    }

    return classReader.findExistingEnrollmentClassLink(input);
  }

  /**
   * @param {{ classId: string }} input
   * @returns {Promise<Record<string, unknown>|null>}
   */
  async getClassCapacitySnapshot(input = {}, classLinkRepository = this.classLinkRepository) {
    if (typeof classLinkRepository?.getClassCapacitySnapshot !== "function") {
      return null;
    }

    return classLinkRepository.getClassCapacitySnapshot(input);
  }

  /**
   * @param {{ classId: string, enrollmentId: string }} input
   * @returns {Promise<unknown|null>}
   */
  async findActiveEnrollmentClassLink(input, classLinkRepository = this.classLinkRepository) {
    if (typeof classLinkRepository?.findActiveByEnrollmentAndClass === "function") {
      return classLinkRepository.findActiveByEnrollmentAndClass(input);
    }

    return null;
  }

  /**
   * @returns {{ createActiveLinkIfNotExists?: (input: Record<string, unknown>) => Promise<unknown|null>, createOrReuseActiveLink?: (input: Record<string, unknown>) => Promise<unknown|null> }}
   */
  getClassLinkRepository(classLinkRepository = this.classLinkRepository) {
    if (
      !classLinkRepository ||
      (
        typeof classLinkRepository.createActiveLinkIfNotExists !== "function" &&
        typeof classLinkRepository.createOrReuseActiveLink !== "function"
      )
    ) {
      throw new TypeError(
        "EnrollmentClassLinkService requires a classLinkRepository.createActiveLinkIfNotExists or createOrReuseActiveLink function.",
      );
    }

    return classLinkRepository;
  }

  /**
   * @param {{ createActiveLinkIfNotExists?: Function, createOrReuseActiveLink?: Function }} repository
   * @param {Record<string, unknown>} input
   * @returns {Promise<unknown|null>}
   */
  async createActiveEnrollmentClassLink(repository, input) {
    if (typeof repository.createActiveLinkIfNotExists === "function") {
      return repository.createActiveLinkIfNotExists(input);
    }

    return repository.createOrReuseActiveLink(input);
  }

  /**
   * @param {(context?: Record<string, unknown>) => Promise<unknown>} work
   * @returns {Promise<unknown>}
   */
  async runLinkTransaction(work) {
    if (!this.transactionRunner) {
      return work({});
    }

    return this.transactionRunner(work);
  }
}

/**
 * @param {unknown} turma
 * @returns {string|null}
 */
function isValidClassIdValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0;
  }

  return /^\d+$/.test(String(value ?? ""));
}

function normalizeClassIdInput(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  const stringValue = String(value).trim();
  return /^\d+$/.test(stringValue) ? Number(stringValue) : stringValue;
}

function readClassStatus(turma) {
  if (typeof readProperty(turma, "ativa") === "boolean") {
    return readProperty(turma, "ativa") ? "ativa" : "inativa";
  }

  return normalizeLowerText(
    readProperty(turma, "status") ||
      readProperty(turma, "classStatus") ||
      readProperty(turma, "situacao"),
  ) || "ativa";
}

/**
 * @param {unknown} turma
 * @returns {number|null}
 */
function readCapacity(turma) {
  const raw =
    readProperty(turma, "capacidadeMaxima") ??
    readProperty(turma, "capacidade") ??
    readProperty(turma, "capacity");
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.trunc(parsed);
}

/**
 * @param {unknown} turma
 * @returns {string[]}
 */
function readCurrentStudents(turma) {
  const raw =
    readProperty(turma, "alunoIds") ??
    readProperty(turma, "studentIds") ??
    readProperty(turma, "aluno_ids_json");
  const parsed = typeof raw === "string" ? safeJsonParse(raw, []) : raw;

  return Array.isArray(parsed)
    ? parsed.map((item) => nullableText(item, 64)).filter(Boolean)
    : [];
}

/**
 * @param {unknown} enrollment
 * @param {Record<string, unknown>} input
 * @param {string[]} fields
 * @returns {string|null}
 */
function readStudentId(enrollment, input, fields) {
  for (const field of fields) {
    const value = nullableText(readProperty(enrollment, field), 64);

    if (value) {
      return value;
    }
  }

  for (const field of fields) {
    const value = nullableText(input[field], 64);

    if (value) {
      return value;
    }
  }

  return null;
}

/**
 * @param {unknown} value
 * @param {unknown} fallback
 * @returns {unknown}
 */
function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    return fallback;
  }
}

/**
 * @param {unknown} value
 * @param {string} property
 * @returns {unknown|null}
 */
function readProperty(value, property) {
  return value && typeof value === "object" ? value[property] ?? null : null;
}

/**
 * @param {unknown} value
 * @param {string} property
 * @param {boolean} fallback
 * @returns {boolean}
 */
function readBooleanProperty(value, property, fallback) {
  const raw = readProperty(value, property);
  return typeof raw === "boolean" ? raw : fallback;
}

/**
 * @param {unknown} link
 * @param {string|null} fallbackLinkedBy
 * @returns {{ linkedAt: string|null, linkedBy: string|null }}
 */
function readLinkAudit(link, fallbackLinkedBy = null) {
  return {
    linkedAt: nullableText(readProperty(link, "linkedAt") ?? readProperty(link, "linked_at"), 32),
    linkedBy: nullableText(
      readProperty(link, "linkedBy") ?? readProperty(link, "linked_by") ?? fallbackLinkedBy,
      191,
    ),
  };
}

/**
 * @param {unknown} link
 * @param {string|null} fallbackLinkedBy
 * @returns {boolean}
 */
function hasLinkAudit(link, fallbackLinkedBy = null) {
  const audit = readLinkAudit(link, fallbackLinkedBy);
  return Boolean(audit.linkedAt && audit.linkedBy);
}

/**
 * @param {unknown} source
 * @param {string[]} properties
 * @returns {number|null}
 */
function readFirstNumber(source, properties) {
  for (const property of properties) {
    const value = readProperty(source, property);
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }

  return null;
}

/**
 * @param {Record<string, unknown>|null} capacitySummary
 * @returns {boolean|null}
 */
function readCapacityAvailable(capacitySummary) {
  const explicit = readProperty(capacitySummary, "hasAvailableCapacity");

  if (typeof explicit === "boolean") {
    return explicit;
  }

  const availableSlots = readFirstNumber(capacitySummary, ["availableSlots", "availableCapacity"]);
  return availableSlots === null ? null : availableSlots > 0;
}

/**
 * @param {Record<string, unknown>|null} capacitySummary
 * @returns {boolean|null}
 */
function readOccupancyConsistent(capacitySummary) {
  const explicit = readProperty(capacitySummary, "occupancyConsistent");

  if (typeof explicit === "boolean") {
    return explicit;
  }

  const occupiedSlots = readFirstNumber(capacitySummary, [
    "occupiedSlots",
    "currentStudentCount",
    "studentCount",
  ]);
  const capacityTotal = readFirstNumber(capacitySummary, ["capacityTotal", "capacity"]);

  if (occupiedSlots === null || capacityTotal === null) {
    return null;
  }

  return occupiedSlots <= capacityTotal;
}

/**
 * @param {{ classFacade?: unknown, transactionContext?: Record<string, unknown>, transactionUsed?: boolean }} input
 * @returns {{ enabled: boolean, lockForUpdate: boolean, occupancySource: string|null }}
 */
function readCapacityTransactionOptions({
  classFacade = null,
  transactionContext = {},
  transactionUsed = false,
} = {}) {
  const enabled = Boolean(
    classFacade &&
      transactionUsed &&
      (
        transactionContext.classCapacityTransactionEnabled === true ||
        transactionContext.transactionQueryRunner ||
        transactionContext.transactionConnection
      ),
  );

  return {
    enabled,
    lockForUpdate: enabled,
    occupancySource: enabled ? "enrollment_class_links" : null,
  };
}

/**
 * @param {{ capacityTransaction?: Record<string, unknown>, recheck?: Record<string, unknown>|null }} input
 * @returns {Record<string, unknown>}
 */
function buildClassCapacityTransactionResult({ capacityTransaction = {}, recheck = null } = {}) {
  return {
    enabled: capacityTransaction.enabled === true,
    lockForUpdate: capacityTransaction.lockForUpdate === true,
    occupancySource: nullableText(capacityTransaction.occupancySource, 64),
    occupiedSlots: readFirstNumber(recheck, ["occupiedSlots", "currentStudentCount", "studentCount"]),
    occupiedSlotsConsistent: readOccupancyConsistent(recheck),
    recheckedInsideTransaction: Boolean(capacityTransaction.enabled && recheck),
  };
}

/**
 * @param {unknown} error
 * @param {{ classId: string|number, classRecord?: unknown }} context
 * @returns {Error}
 */
function mapClassFacadeError(error, context = {}) {
  const code = error && typeof error === "object" ? error.code : null;
  const details = readObject(readProperty(error, "details"));
  const classId = details.classId ?? context.classId;

  if (code === "CLASS_INPUT_REQUIRED") {
    return controlledError(
      "prepareActiveEnrollmentClassLink requires a numeric classId compatible with j12_turmas.id.",
      ENROLLMENT_CLASS_LINK_INVALID_CLASS_ID_CODE,
      {
        ...details,
        classId,
      },
    );
  }

  if (code === "CLASS_NOT_FOUND") {
    return controlledError(
      "Class was not found for Enrollment class link preparation.",
      ENROLLMENT_CLASS_LINK_CLASS_NOT_FOUND_CODE,
      {
        ...details,
        classId,
      },
    );
  }

  if (code === "CLASS_INACTIVE") {
    return controlledError(
      "Class must be active before an Enrollment class link can be prepared.",
      ENROLLMENT_CLASS_LINK_INVALID_CLASS_STATUS_CODE,
      {
        ...details,
        classId,
        classStatus: readClassStatus(context.classRecord),
        requiredClassStatus: "ativa",
      },
    );
  }

  if (code === "CLASS_CAPACITY_UNCONFIGURED") {
    return controlledError(
      "Class capacity is not configured for Enrollment class link preparation.",
      ENROLLMENT_CLASS_LINK_CLASS_CAPACITY_UNCONFIGURED_CODE,
      {
        ...details,
        classId,
      },
    );
  }

  if (code === "CLASS_CAPACITY_FULL" || code === "CLASS_CAPACITY_OVERBOOKED") {
    return controlledError(
      "Class has no available capacity for Enrollment class link preparation.",
      ENROLLMENT_CLASS_LINK_CLASS_FULL_CODE,
      {
        ...details,
        activeLinkCount: details.occupiedSlots ?? null,
        capacity: details.capacityTotal ?? null,
        classId,
        currentStudents: details.occupiedSlots ?? null,
      },
    );
  }

  return error instanceof Error ? error : new Error(String(error ?? "Unknown ClassFacade error"));
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function normalizeCount(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeLowerText(value) {
  const normalized = nullableText(value, 64);
  return normalized ? normalized.toLowerCase() : null;
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
 * @param {Record<string, unknown>} [details]
 * @returns {Error}
 */
function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;

  for (const [key, value] of Object.entries(details)) {
    error[key] = value;
  }

  return error;
}

module.exports = {
  ENROLLMENT_CLASS_LINK_CLASS_CAPACITY_UNCONFIGURED_CODE,
  ENROLLMENT_CLASS_LINK_CLASS_FULL_CODE,
  ENROLLMENT_CLASS_LINK_CLASS_NOT_FOUND_CODE,
  ENROLLMENT_CLASS_LINK_DUPLICATE_CODE,
  ENROLLMENT_CLASS_LINK_ENROLLMENT_NOT_FOUND_CODE,
  ENROLLMENT_CLASS_LINK_INPUT_REQUIRED_CODE,
  EnrollmentClassLinkService,
};
