const { EnrollmentCreatedEvent } = require("../events/enrollment-created.event.js");
const {
  EnrollmentFacade,
  MySqlEnrollmentRepository,
} = require("../../../enrollments");
const { PersonApplicationService } = require("./person-application.service.js");
const { ProfileApplicationService } = require("./profile-application.service.js");
const { RelationshipApplicationService } = require("./relationship-application.service.js");
const { StudentApplicationService } = require("./student-application.service.js");

const CREATE_RESPONSIBLE_PERSON_STEP = "createResponsiblePerson";
const CREATE_RESPONSIBLE_PROFILE_STEP = "createResponsibleProfile";
const CREATE_RESPONSIBLE_STUDENT_RELATIONSHIP_STEP = "createResponsibleStudentRelationship";
const CREATE_DRAFT_ENROLLMENT_STEP = "createDraftEnrollment";
const PERSIST_DRAFT_ENROLLMENT_STEP = "persistDraftEnrollment";
const READ_DRAFT_ENROLLMENT_STEP = "readDraftEnrollment";
const DRAFT_ENROLLMENT_READ_FAILED_CODE = "DRAFT_ENROLLMENT_READ_FAILED";
const DRAFT_ENROLLMENT_LOCK_TIMEOUT_CODE = "DRAFT_ENROLLMENT_LOCK_TIMEOUT";
const DRAFT_ENROLLMENT_PERSISTENCE_TABLE_MISSING_CODE = "DRAFT_ENROLLMENT_PERSISTENCE_TABLE_MISSING";
const DRAFT_ENROLLMENT_PERSISTENCE_FAILED_CODE = "DRAFT_ENROLLMENT_PERSISTENCE_FAILED";

/**
 * Application service responsible for enrollment orchestration.
 *
 * Sprint 9.9 resolves or creates the student Pessoa through
 * StudentApplicationService before creating the responsible-student
 * relationship. Sprint 9.15 integrates only the in-memory Enrollment draft
 * from the enrollments domain; it still does not persist enrollment records,
 * contracts, finance entries or classes.
 * Sprint 9.25 persists the draft Enrollment through the enrollments domain
 * repository after the safe Pessoas/Profile/Relationship flow. Sprint 9.26
 * reads an existing persisted draft before creating a new one.
 * Sprint 9.41 routes Enrollment domain operations through EnrollmentFacade.
 */
class EnrollmentApplicationService {
  /**
   * @param {Object} [options]
   * @param {PersonApplicationService} [options.personApplicationService]
   * @param {ProfileApplicationService} [options.profileApplicationService]
   * @param {RelationshipApplicationService} [options.relationshipApplicationService]
   * @param {StudentApplicationService} [options.studentApplicationService]
   * @param {EnrollmentFacade} [options.enrollmentFacade]
   * @param {{ create: (enrollment: unknown) => Promise<unknown> }} [options.enrollmentRepository]
   * @param {{ error?: (message: string, context?: Record<string, unknown>) => void, info?: (message: string, context?: Record<string, unknown>) => void }} [options.enrollmentPersistenceLogger]
   * @param {boolean} [options.draftEnrollmentPersistenceBlocked]
   * @param {boolean} [options.draftEnrollmentPersistenceEnabled]
   * @param {() => string} [options.clock]
   */
  constructor({
    clock = nowIso,
    draftEnrollmentPersistenceBlocked = false,
    draftEnrollmentPersistenceEnabled = true,
    enrollmentFacade = null,
    enrollmentPersistenceLogger = console,
    enrollmentRepository = null,
    personApplicationService = null,
    profileApplicationService = null,
    relationshipApplicationService = null,
    studentApplicationService = null,
  } = {}) {
    this.clock = clock;
    this.draftEnrollmentPersistenceBlocked = Boolean(draftEnrollmentPersistenceBlocked);
    this.draftEnrollmentPersistenceEnabled = Boolean(draftEnrollmentPersistenceEnabled);
    this.enrollmentFacade = enrollmentFacade;
    this.enrollmentPersistenceLogger = enrollmentPersistenceLogger;
    this.enrollmentRepository = enrollmentRepository;
    this.personApplicationService = personApplicationService;
    this.profileApplicationService = profileApplicationService;
    this.relationshipApplicationService = relationshipApplicationService;
    this.studentApplicationService = studentApplicationService;
  }

  /**
   * Creates the currently approved enrollment artifacts.
   *
   * @param {import("../commands/create-enrollment.command.js").CreateEnrollmentCommand|{ responsaveis: Array<Record<string, unknown>> }} command
   * @returns {Promise<{ draftEnrollment: unknown|null, enrollmentCreatedEvent: Record<string, unknown>, metadata: Record<string, unknown>, responsiblePerson: unknown, responsibleProfile: unknown, studentPerson: unknown|null, studentProfile: unknown|null, responsibleStudentRelationship: unknown|null, warnings: Array<unknown> }>}
   */
  async createEnrollment(command) {
    const responsible = getFirstResponsible(command);
    const student = getStudent(command);
    const responsiblePersonPayload = mapResponsibleToPersonPayload(responsible);
    const responsiblePerson = await this.getPersonApplicationService().createPerson(responsiblePersonPayload);
    const responsibleProfile = await this.getProfileApplicationService().createResponsibleProfile(responsiblePerson);
    const studentResolution = await this.getStudentApplicationService().resolveStudentPerson(student);
    const resolvedStudent = buildStudentRelationshipInput(student, studentResolution.studentPersonId);
    const responsibleStudentRelationship = studentResolution.studentPersonId
      ? await this.getRelationshipApplicationService().createResponsibleStudentRelationship({
          responsible,
          responsiblePerson,
          student: resolvedStudent,
        })
      : null;
    const draftEnrollmentResolution = await this.createDraftEnrollmentAndPersist({
      command,
      responsibleStudentRelationship,
      studentResolution,
    });
    const completedStep = draftEnrollmentResolution.persisted
      ? PERSIST_DRAFT_ENROLLMENT_STEP
      : draftEnrollmentResolution.foundPersisted
        ? READ_DRAFT_ENROLLMENT_STEP
      : draftEnrollmentResolution.draftEnrollment
        ? CREATE_DRAFT_ENROLLMENT_STEP
      : responsibleStudentRelationship
        ? CREATE_RESPONSIBLE_STUDENT_RELATIONSHIP_STEP
        : readCompletedStep(studentResolution, CREATE_RESPONSIBLE_PROFILE_STEP);
    const enrollmentCreatedEvent = new EnrollmentCreatedEvent({
      occurredAt: this.clock(),
      payload: {
        draftEnrollmentStatus: readProperty(draftEnrollmentResolution.draftEnrollment, "status"),
        responsiblePersonId: readId(responsiblePerson),
        responsibleProfileId: readId(responsibleProfile),
        studentPersonId: studentResolution.studentPersonId,
        studentProfileId: readId(studentResolution.studentProfile),
        responsibleStudentRelationshipId: readId(responsibleStudentRelationship),
        step: completedStep,
      },
    });

    return {
      draftEnrollment: draftEnrollmentResolution.draftEnrollment,
      enrollmentCreatedEvent: enrollmentCreatedEvent.toJSON(),
      metadata: {
        step: completedStep,
      },
      responsiblePerson,
      responsibleProfile,
      studentPerson: studentResolution.studentPerson,
      studentProfile: studentResolution.studentProfile,
      responsibleStudentRelationship,
      warnings: [...normalizeWarnings(studentResolution.warnings), ...normalizeWarnings(draftEnrollmentResolution.warnings)],
    };
  }

  /**
   * Creates the in-memory Enrollment draft after the persisted/safe Pessoas flow.
   *
   * @param {Object} input
   * @param {import("../commands/create-enrollment.command.js").CreateEnrollmentCommand|Record<string, unknown>} input.command
   * @param {unknown|null} input.responsibleStudentRelationship
   * @param {{ studentPersonId?: string|null, studentProfile?: unknown }} input.studentResolution
   * @returns {{ draftEnrollment: unknown|null, warnings: Array<{ field: string, message: string, code: string }> }}
   */
  createDraftEnrollment({ command, responsibleStudentRelationship = null, studentResolution = {} } = {}) {
    const resolution = this.resolveDraftEnrollmentInput({
      command,
      responsibleStudentRelationship,
      studentResolution,
    });

    if (!resolution.draftEnrollmentInput) {
      return {
        draftEnrollment: null,
        warnings: resolution.warnings,
      };
    }

    const draftEnrollment = this.getEnrollmentFacade({
      requiredMethods: ["createDraftEnrollment"],
    }).createDraftEnrollment(
      resolution.draftEnrollmentInput,
    );

    return {
      draftEnrollment,
      warnings: this.buildDraftEnrollmentPersistenceWarnings(draftEnrollment),
    };
  }

  /**
   * Creates or reuses a persisted draft Enrollment through the enrollments
   * domain. If persistence fails, the Pessoas flow continues with an in-memory
   * draft and a warning. No persisted state is reported unless the repository
   * confirms creation or reuse.
   *
   * @param {Object} input
   * @param {import("../commands/create-enrollment.command.js").CreateEnrollmentCommand|Record<string, unknown>} input.command
   * @param {unknown|null} input.responsibleStudentRelationship
   * @param {{ studentPersonId?: string|null, studentProfile?: unknown }} input.studentResolution
   * @returns {Promise<{ draftEnrollment: unknown|null, foundPersisted: boolean, persisted: boolean, warnings: Array<{ field: string, message: string, code: string }> }>}
   */
  async createDraftEnrollmentAndPersist({ command, responsibleStudentRelationship = null, studentResolution = {} } = {}) {
    const resolution = this.resolveDraftEnrollmentInput({
      command,
      responsibleStudentRelationship,
      studentResolution,
    });

    if (!resolution.draftEnrollmentInput) {
      return {
        draftEnrollment: null,
        foundPersisted: false,
        persisted: false,
        warnings: resolution.warnings,
      };
    }

    if (!this.draftEnrollmentPersistenceEnabled || this.draftEnrollmentPersistenceBlocked) {
      const draftEnrollment = this.getEnrollmentFacade({
        requiredMethods: ["createDraftEnrollment"],
      }).createDraftEnrollment(
        resolution.draftEnrollmentInput,
      );
      this.logDraftEnrollmentPersistenceFallback(
        this.draftEnrollmentPersistenceBlocked ? "persistence_blocked" : "persistence_disabled",
        resolution.draftEnrollmentInput,
      );

      return {
        draftEnrollment,
        foundPersisted: false,
        persisted: false,
        warnings: [...resolution.warnings, ...this.buildDraftEnrollmentPersistenceWarnings(draftEnrollment)],
      };
    }

    try {
      const persistence = await this.createOrReusePersistedDraftEnrollment(resolution.draftEnrollmentInput);

      return {
        draftEnrollment: persistence.draftEnrollment,
        foundPersisted: persistence.reused,
        persisted: persistence.created,
        warnings: resolution.warnings,
      };
    } catch (error) {
      this.logDraftEnrollmentPersistenceError(error, resolution.draftEnrollmentInput);

      const draftEnrollment = this.getEnrollmentFacade({
        requiredMethods: ["createDraftEnrollment"],
      }).createDraftEnrollment(
        resolution.draftEnrollmentInput,
      );
      this.logDraftEnrollmentPersistenceFallback(
        error && typeof error === "object" ? error.code ?? "persistence_error" : "persistence_error",
        resolution.draftEnrollmentInput,
      );

      return {
        draftEnrollment,
        foundPersisted: false,
        persisted: false,
        warnings: [
          ...resolution.warnings,
          buildDraftEnrollmentPersistenceFailureWarning(error),
        ],
      };
    }
  }

  /**
   * @param {Record<string, unknown>} draftEnrollmentInput
   * @returns {Promise<{ draftEnrollment: unknown|null, created: boolean, reused: boolean }>}
   */
  async createOrReusePersistedDraftEnrollment(draftEnrollmentInput = {}) {
    const enrollmentFacade = this.getEnrollmentFacade({
      persistenceRequired: true,
    });
    const hasIdempotentCreate = typeof enrollmentFacade.createDraftEnrollmentIdempotently === "function";
    const hasCurrentDraftRead = typeof enrollmentFacade.findCurrentDraftEnrollment === "function";
    const hasLegacyDraftRead = typeof enrollmentFacade.findDraftEnrollment === "function";
    const hasLegacyReadCreate =
      typeof enrollmentFacade.createDraftEnrollmentAndPersist === "function" &&
      (hasCurrentDraftRead || hasLegacyDraftRead);

    if (!hasIdempotentCreate && !hasLegacyReadCreate) {
      throw new TypeError(
        "EnrollmentApplicationService requires an enrollmentFacade.createDraftEnrollmentIdempotently function or findCurrentDraftEnrollment/createDraftEnrollmentAndPersist functions.",
      );
    }

    if (hasIdempotentCreate) {
      const result = await enrollmentFacade.createDraftEnrollmentIdempotently(
        draftEnrollmentInput,
      );
      const persistence = normalizeDraftEnrollmentPersistenceResult(result);

      this.logDraftEnrollmentPersistenceResult(persistence, draftEnrollmentInput);

      return persistence;
    }

    const persistedDraftEnrollment = await this.findPersistedDraftEnrollment(draftEnrollmentInput);

    if (persistedDraftEnrollment) {
      const persistence = {
        created: false,
        draftEnrollment: persistedDraftEnrollment,
        reused: true,
      };

      this.logDraftEnrollmentPersistenceResult(persistence, draftEnrollmentInput);

      return persistence;
    }

    const createdDraftEnrollment = await enrollmentFacade.createDraftEnrollmentAndPersist(
      draftEnrollmentInput,
    );
    const persistence = {
      created: true,
      draftEnrollment: createdDraftEnrollment,
      reused: false,
    };

    this.logDraftEnrollmentPersistenceResult(persistence, draftEnrollmentInput);

    return persistence;
  }

  /**
   * @param {Object} input
   * @param {import("../commands/create-enrollment.command.js").CreateEnrollmentCommand|Record<string, unknown>} input.command
   * @param {unknown|null} input.responsibleStudentRelationship
   * @param {{ studentPersonId?: string|null, studentProfile?: unknown }} input.studentResolution
   * @returns {{ draftEnrollmentInput: Record<string, unknown>|null, warnings: Array<{ field: string, message: string, code: string }> }}
   */
  resolveDraftEnrollmentInput({ command, responsibleStudentRelationship = null, studentResolution = {} } = {}) {
    if (!responsibleStudentRelationship) {
      return {
        draftEnrollmentInput: null,
        warnings: [],
      };
    }

    const startDate = readDraftEnrollmentStartDate(command);

    if (!startDate) {
      return {
        draftEnrollmentInput: null,
        warnings: [
          warning(
            "matricula.startDate",
            "Draft Enrollment was not created because startDate is missing from the payload.",
            "DRAFT_ENROLLMENT_START_DATE_MISSING",
          ),
        ],
      };
    }

    const studentPersonId = nullableText(studentResolution.studentPersonId);
    const studentProfileId = readId(studentResolution.studentProfile);

    if (!studentPersonId || !studentProfileId) {
      return {
        draftEnrollmentInput: null,
        warnings: [],
      };
    }

    return {
      draftEnrollmentInput: {
        startDate,
        studentPersonId,
        studentProfileId,
      },
      warnings: [],
    };
  }

  /**
   * @param {unknown|null} draftEnrollment
   * @returns {Array<{ field: string, message: string, code: string }>}
   */
  buildDraftEnrollmentPersistenceWarnings(draftEnrollment = null) {
    if (!draftEnrollment || !this.draftEnrollmentPersistenceBlocked) {
      return [];
    }

    return [
      warning(
        "enrollments",
        "Draft Enrollment was not persisted because the enrollments table is not available.",
        DRAFT_ENROLLMENT_PERSISTENCE_TABLE_MISSING_CODE,
      ),
    ];
  }

  /**
   * @returns {PersonApplicationService}
   */
  getPersonApplicationService() {
    if (!this.personApplicationService) {
      this.personApplicationService = new PersonApplicationService();
    }

    if (typeof this.personApplicationService?.createPerson !== "function") {
      throw new TypeError("EnrollmentApplicationService requires a personApplicationService.createPerson function.");
    }

    return this.personApplicationService;
  }

  /**
   * @returns {ProfileApplicationService}
   */
  getProfileApplicationService() {
    if (!this.profileApplicationService) {
      this.profileApplicationService = new ProfileApplicationService();
    }

    if (typeof this.profileApplicationService?.createResponsibleProfile !== "function") {
      throw new TypeError(
        "EnrollmentApplicationService requires a profileApplicationService.createResponsibleProfile function.",
      );
    }

    return this.profileApplicationService;
  }

  /**
   * @returns {RelationshipApplicationService}
   */
  getRelationshipApplicationService() {
    if (!this.relationshipApplicationService) {
      this.relationshipApplicationService = new RelationshipApplicationService();
    }

    if (typeof this.relationshipApplicationService?.createResponsibleStudentRelationship !== "function") {
      throw new TypeError(
        "EnrollmentApplicationService requires a relationshipApplicationService.createResponsibleStudentRelationship function.",
      );
    }

    return this.relationshipApplicationService;
  }

  /**
   * @returns {StudentApplicationService}
   */
  getStudentApplicationService() {
    if (!this.studentApplicationService) {
      this.studentApplicationService = new StudentApplicationService({
        personApplicationService: this.getPersonApplicationService(),
        profileApplicationService: this.getProfileApplicationService(),
      });
    }

    if (typeof this.studentApplicationService?.resolveStudentPerson !== "function") {
      throw new TypeError("EnrollmentApplicationService requires a studentApplicationService.resolveStudentPerson function.");
    }

    return this.studentApplicationService;
  }

  /**
   * @param {Object} [options]
   * @param {boolean} [options.persistenceRequired]
   * @param {string[]} [options.requiredMethods]
   * @returns {EnrollmentFacade}
   */
  getEnrollmentFacade({ persistenceRequired = false, requiredMethods = [] } = {}) {
    const enrollmentFacade = this.enrollmentFacade || new EnrollmentFacade({
      enrollmentRepository: persistenceRequired ? this.getEnrollmentRepository() : null,
    });

    if (persistenceRequired && !this.enrollmentFacade) {
      this.enrollmentFacade = enrollmentFacade;
    }

    for (const method of requiredMethods) {
      if (typeof enrollmentFacade?.[method] !== "function") {
        throw new TypeError(`EnrollmentApplicationService requires an enrollmentFacade.${method} function.`);
      }
    }

    return enrollmentFacade;
  }

  /**
   * @param {Record<string, unknown>} draftEnrollmentInput
   * @returns {Promise<unknown|null>}
   */
  async findPersistedDraftEnrollment(draftEnrollmentInput = {}) {
    const enrollmentFacade = this.getEnrollmentFacade({
      persistenceRequired: true,
    });
    const query = typeof enrollmentFacade.findCurrentDraftEnrollment === "function"
      ? enrollmentFacade.findCurrentDraftEnrollment
      : enrollmentFacade.findDraftEnrollment;

    if (typeof query !== "function") {
      throw new TypeError(
        "EnrollmentApplicationService requires an enrollmentFacade.findCurrentDraftEnrollment or enrollmentFacade.findDraftEnrollment function.",
      );
    }

    return query.call(enrollmentFacade, {
      studentPersonId: draftEnrollmentInput.studentPersonId,
      studentProfileId: draftEnrollmentInput.studentProfileId,
    });
  }

  /**
   * @returns {{ create: (enrollment: unknown) => Promise<unknown> }}
   */
  getEnrollmentRepository() {
    if (!this.enrollmentRepository) {
      this.enrollmentRepository = new MySqlEnrollmentRepository();
    }

    if (typeof this.enrollmentRepository?.create !== "function") {
      throw new TypeError("EnrollmentApplicationService requires an enrollmentRepository.create function.");
    }

    return this.enrollmentRepository;
  }

  /**
   * @param {unknown} error
   * @param {Record<string, unknown>} draftEnrollmentInput
   * @returns {void}
   */
  logDraftEnrollmentPersistenceError(error, draftEnrollmentInput = {}) {
    if (typeof this.enrollmentPersistenceLogger?.error !== "function") {
      return;
    }

    this.enrollmentPersistenceLogger.error("[enrollments] Draft Enrollment persistence failed.", {
      code: error && typeof error === "object" ? error.code ?? null : null,
      message: error instanceof Error ? error.message : String(error ?? "Unknown error"),
      studentPersonId: draftEnrollmentInput.studentPersonId ?? null,
      studentProfileId: draftEnrollmentInput.studentProfileId ?? null,
    });
  }

  /**
   * @param {unknown} reasonCode
   * @param {Record<string, unknown>} draftEnrollmentInput
   * @returns {void}
   */
  logDraftEnrollmentPersistenceFallback(reasonCode, draftEnrollmentInput = {}) {
    if (typeof this.enrollmentPersistenceLogger?.info !== "function") {
      return;
    }

    this.enrollmentPersistenceLogger.info("[enrollments] Draft Enrollment persistence fallback activated.", {
      reasonCode: nullableText(reasonCode) || "unknown",
      studentPersonId: draftEnrollmentInput.studentPersonId ?? null,
      studentProfileId: draftEnrollmentInput.studentProfileId ?? null,
    });
  }

  /**
   * @param {{ draftEnrollment: unknown|null, created: boolean, reused: boolean }} persistence
   * @param {Record<string, unknown>} draftEnrollmentInput
   * @returns {void}
   */
  logDraftEnrollmentPersistenceResult(persistence = {}, draftEnrollmentInput = {}) {
    if (typeof this.enrollmentPersistenceLogger?.info !== "function") {
      return;
    }

    if (persistence.reused) {
      this.enrollmentPersistenceLogger.info("[enrollments] Reused persisted draft Enrollment.", {
        enrollmentId: readId(persistence.draftEnrollment),
        studentPersonId: draftEnrollmentInput.studentPersonId ?? null,
        studentProfileId: draftEnrollmentInput.studentProfileId ?? null,
      });

      return;
    }

    if (persistence.created) {
      this.enrollmentPersistenceLogger.info("[enrollments] Created persisted draft Enrollment.", {
        enrollmentId: readId(persistence.draftEnrollment),
        studentPersonId: draftEnrollmentInput.studentPersonId ?? null,
        studentProfileId: draftEnrollmentInput.studentProfileId ?? null,
      });
    }
  }

  /**
   * @param {unknown} error
   * @param {Record<string, unknown>} draftEnrollmentInput
   * @returns {void}
   */
  logDraftEnrollmentReadError(error, draftEnrollmentInput = {}) {
    if (typeof this.enrollmentPersistenceLogger?.error !== "function") {
      return;
    }

    this.enrollmentPersistenceLogger.error("[enrollments] Draft Enrollment read failed.", {
      code: error && typeof error === "object" ? error.code ?? null : null,
      message: error instanceof Error ? error.message : String(error ?? "Unknown error"),
      studentPersonId: draftEnrollmentInput.studentPersonId ?? null,
      studentProfileId: draftEnrollmentInput.studentProfileId ?? null,
    });
  }
}

/**
 * @param {import("../commands/create-enrollment.command.js").CreateEnrollmentCommand|{ responsaveis?: Array<Record<string, unknown>> }} command
 * @returns {Record<string, unknown>}
 */
function getFirstResponsible(command) {
  if (typeof command?.getFirstResponsible === "function") {
    return command.getFirstResponsible();
  }

  const responsible = Array.isArray(command?.responsaveis) ? command.responsaveis[0] : null;
  return responsible && typeof responsible === "object" && !Array.isArray(responsible) ? responsible : {};
}

/**
 * @param {import("../commands/create-enrollment.command.js").CreateEnrollmentCommand|{ aluno?: Record<string, unknown> }} command
 * @returns {Record<string, unknown>}
 */
function getStudent(command) {
  const payload = typeof command?.getPayload === "function" ? command.getPayload() : command;
  const student = payload && typeof payload === "object" ? payload.aluno : null;

  return student && typeof student === "object" && !Array.isArray(student) ? student : {};
}

/**
 * @param {import("../commands/create-enrollment.command.js").CreateEnrollmentCommand|Record<string, unknown>} command
 * @returns {Record<string, unknown>}
 */
function getEnrollmentData(command) {
  const payload = typeof command?.getPayload === "function" ? command.getPayload() : command;
  const enrollment = payload && typeof payload === "object" ? payload.matricula : null;

  return normalizeObject(enrollment);
}

/**
 * @param {Record<string, unknown>} responsavel
 * @returns {Record<string, unknown>}
 */
function mapResponsibleToPersonPayload(responsavel = {}) {
  return {
    ativo: true,
    bairro: nullableText(responsavel.bairro ?? responsavel.endereco?.bairro),
    celular: nullableText(responsavel.celular ?? responsavel.whatsapp),
    cep: nullableText(responsavel.cep ?? responsavel.endereco?.cep),
    cidade: nullableText(responsavel.cidade ?? responsavel.endereco?.cidade),
    complemento: nullableText(responsavel.complemento ?? responsavel.endereco?.complemento),
    cpf: nullableText(responsavel.cpf),
    dataNascimento: nullableText(responsavel.dataNascimento),
    email: nullableText(responsavel.email),
    estado: nullableText(responsavel.estado ?? responsavel.endereco?.estado),
    logradouro: nullableText(responsavel.logradouro ?? responsavel.endereco?.logradouro ?? responsavel.endereco?.rua),
    nome: text(responsavel.nome),
    numero: nullableText(responsavel.numero ?? responsavel.endereco?.numero),
    rg: nullableText(responsavel.rg),
    sexo: nullableText(responsavel.sexo),
    telefone: nullableText(responsavel.telefone),
  };
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function readId(value) {
  return value && typeof value === "object" ? value.id ?? null : null;
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
 * @param {import("../commands/create-enrollment.command.js").CreateEnrollmentCommand|Record<string, unknown>} command
 * @returns {string|null}
 */
function readDraftEnrollmentStartDate(command) {
  return nullableText(getEnrollmentData(command).startDate);
}

/**
 * @param {Record<string, unknown>} student
 * @param {string|null} studentPersonId
 * @returns {Record<string, unknown>}
 */
function buildStudentRelationshipInput(student = {}, studentPersonId = null) {
  return {
    ...normalizeObject(student),
    personId: nullableText(studentPersonId),
  };
}

/**
 * @param {Record<string, unknown>} value
 * @param {string} fallback
 * @returns {string}
 */
function readCompletedStep(value, fallback) {
  const step = value?.metadata?.step;
  return nullableText(step) || fallback;
}

/**
 * @param {unknown} value
 * @returns {Array<unknown>}
 */
function normalizeWarnings(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * @param {unknown} value
 * @returns {{ draftEnrollment: unknown|null, created: boolean, reused: boolean }}
 */
function normalizeDraftEnrollmentPersistenceResult(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const draftEnrollment = source.draftEnrollment ?? source.enrollment ?? null;
  const reused = source.reused === true;
  const created = !reused && source.created === true;

  return {
    created,
    draftEnrollment,
    reused,
  };
}

/**
 * @param {unknown} errorValue
 * @returns {{ field: string, message: string, code: string }}
 */
function buildDraftEnrollmentPersistenceFailureWarning(errorValue) {
  const code = errorValue && typeof errorValue === "object" ? errorValue.code : null;

  if (code === DRAFT_ENROLLMENT_LOCK_TIMEOUT_CODE) {
    return warning(
      "enrollments",
      "Draft Enrollment idempotency lock was not acquired; the flow continued with an in-memory draft.",
      DRAFT_ENROLLMENT_LOCK_TIMEOUT_CODE,
    );
  }

  return warning(
    "enrollments",
    "Draft Enrollment persistence failed; the flow continued with an in-memory draft.",
    DRAFT_ENROLLMENT_PERSISTENCE_FAILED_CODE,
  );
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function text(value) {
  return String(value ?? "").trim();
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function nullableText(value) {
  const normalized = text(value);
  return normalized || null;
}

/**
 * @param {string} field
 * @param {string} message
 * @param {string} code
 * @returns {{ field: string, message: string, code: string }}
 */
function warning(field, message, code) {
  return { code, field, message };
}

/**
 * @returns {string}
 */
function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  CREATE_DRAFT_ENROLLMENT_STEP,
  DRAFT_ENROLLMENT_LOCK_TIMEOUT_CODE,
  DRAFT_ENROLLMENT_READ_FAILED_CODE,
  DRAFT_ENROLLMENT_PERSISTENCE_TABLE_MISSING_CODE,
  DRAFT_ENROLLMENT_PERSISTENCE_FAILED_CODE,
  PERSIST_DRAFT_ENROLLMENT_STEP,
  READ_DRAFT_ENROLLMENT_STEP,
  CREATE_RESPONSIBLE_STUDENT_RELATIONSHIP_STEP,
  CREATE_RESPONSIBLE_PROFILE_STEP,
  CREATE_RESPONSIBLE_PERSON_STEP,
  EnrollmentApplicationService,
  getEnrollmentData,
  getFirstResponsible,
  getStudent,
  buildStudentRelationshipInput,
  mapResponsibleToPersonPayload,
  readDraftEnrollmentStartDate,
};
