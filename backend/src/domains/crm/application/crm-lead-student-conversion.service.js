const CRM_LEAD_STUDENT_CONVERSION_ERROR_CODES = Object.freeze({
  CONFLICT: "CRM_LEAD_STUDENT_CONVERSION_CONFLICT",
  DATA_INCOMPLETE: "CRM_CONVERSION_DATA_INCOMPLETE",
  FAILED: "CRM_LEAD_STUDENT_CONVERSION_FAILED",
  NOT_CONVERTIBLE: "CRM_LEAD_NOT_CONVERTIBLE",
  NOT_FOUND: "CRM_LEAD_NOT_FOUND",
});

const STUDENT_FIELDS = new Set([
  "personId",
  "person_id",
  "cpf",
  "nome",
  "nomeCompleto",
  "dataNascimento",
  "sexo",
  "email",
  "telefone",
  "celular",
  "whatsapp",
  "rg",
  "endereco",
  "bairro",
  "cep",
  "cidade",
  "estado",
  "logradouro",
  "numero",
  "complemento",
]);

/** Safely links a WON CRM Lead to the canonical Pessoa and Aluno profile. */
class CrmLeadStudentConversionService {
  constructor({
    leadRepository = null,
    studentApplicationService = null,
    conversionRepository = null,
    authorizeUnit = () => true,
    now = () => new Date(),
  } = {}) {
    this.leadRepository = leadRepository;
    this.studentApplicationService = studentApplicationService;
    this.conversionRepository = conversionRepository;
    this.authorizeUnit = authorizeUnit;
    this.now = now;
  }

  async convertLeadToStudent(input = {}, context = {}) {
    const leadId = text(input.leadId);
    const unitId = text(context.unitId);
    this.authorize(context, unitId);
    if (!leadId) throw crmError("CRM leadId required.", "CRM_INPUT_INVALID", 422);

    const lead = await this.getLeadRepository().findById({ id: leadId, unitId });
    if (!lead)
      throw crmError(
        "CRM Lead was not found.",
        CRM_LEAD_STUDENT_CONVERSION_ERROR_CODES.NOT_FOUND,
        404,
      );
    if (lead.stage !== "WON" || lead.status !== "CONVERTED") {
      throw crmError(
        "CRM Lead is not convertible.",
        CRM_LEAD_STUDENT_CONVERSION_ERROR_CODES.NOT_CONVERTIBLE,
        409,
      );
    }

    const conversionRepository = this.getConversionRepository();
    const existing = await conversionRepository.findByLeadId({ leadId, unitId });
    if (existing) return resultFromExisting(existing);

    const studentData = prepareStudentData(input.studentData);
    let studentResolution;
    try {
      studentResolution = await this.getStudentApplicationService().resolveOrCreateStudent(
        studentData,
        context,
      );
    } catch (error) {
      if (isCanonicalStudentError(error)) throw error;
      throw crmError(
        "CRM Lead student conversion failed.",
        CRM_LEAD_STUDENT_CONVERSION_ERROR_CODES.FAILED,
        500,
      );
    }

    let persisted;
    try {
      persisted = await conversionRepository.create({
        convertedAt: this.now().toISOString(),
        convertedBy: context.userId,
        idempotencyKey: `crm-lead-student:${leadId}`,
        leadId,
        personId: studentResolution.personId,
        personProfileId: studentResolution.personProfileId,
        status: "COMPLETED",
        unitId,
      });
    } catch (error) {
      if (error?.code === CRM_LEAD_STUDENT_CONVERSION_ERROR_CODES.CONFLICT) throw error;
      throw crmError(
        "CRM Lead student conversion failed.",
        CRM_LEAD_STUDENT_CONVERSION_ERROR_CODES.FAILED,
        500,
      );
    }

    const conversion = persisted?.conversion;
    if (!conversion) {
      throw crmError(
        "CRM Lead student conversion failed.",
        CRM_LEAD_STUDENT_CONVERSION_ERROR_CODES.FAILED,
        500,
      );
    }
    if (
      conversion.personId !== studentResolution.personId ||
      conversion.personProfileId !== studentResolution.personProfileId
    ) {
      throw crmError(
        "CRM Lead student conversion conflict.",
        CRM_LEAD_STUDENT_CONVERSION_ERROR_CODES.CONFLICT,
        409,
      );
    }

    return Object.freeze({
      conversionStatus: "COMPLETED",
      leadId,
      personId: conversion.personId,
      personProfileId: conversion.personProfileId,
      resolutions: Object.freeze({
        person: studentResolution.personResolution,
        profile: studentResolution.profileResolution,
      }),
      reused: Object.freeze({
        person: Boolean(studentResolution.reused?.person),
        profile: Boolean(studentResolution.reused?.profile),
      }),
    });
  }

  authorize(context, unitId) {
    if (!context?.userId || !unitId || !this.authorizeUnit(context, unitId)) {
      throw crmError("CRM access denied.", "CRM_ACCESS_DENIED", 403);
    }
  }
  getLeadRepository() {
    if (typeof this.leadRepository?.findById !== "function")
      throw new TypeError("CRM Lead repository is required.");
    return this.leadRepository;
  }
  getStudentApplicationService() {
    if (typeof this.studentApplicationService?.resolveOrCreateStudent !== "function") {
      throw new TypeError("Canonical Student application service is required.");
    }
    return this.studentApplicationService;
  }
  getConversionRepository() {
    if (
      typeof this.conversionRepository?.findByLeadId !== "function" ||
      typeof this.conversionRepository?.create !== "function"
    ) {
      throw new TypeError("CRM Lead student conversion repository is required.");
    }
    return this.conversionRepository;
  }
}

function prepareStudentData(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const unsupportedFields = Object.keys(source).filter((field) => !STUDENT_FIELDS.has(field));
  if (unsupportedFields.length) {
    throw crmError("CRM conversion input is invalid.", "CRM_INPUT_INVALID", 422, {
      fields: unsupportedFields.map((field) => `studentData.${field}`),
    });
  }
  const personId = text(source.personId ?? source.person_id);
  const missing = personId
    ? []
    : ["nome", "dataNascimento", "sexo"].filter((field) => !text(source[field]));
  if (!personId && missing.length) {
    throw crmError(
      "CRM conversion data is incomplete.",
      CRM_LEAD_STUDENT_CONVERSION_ERROR_CODES.DATA_INCOMPLETE,
      422,
      { fields: missing.map((field) => `studentData.${field}`) },
    );
  }
  return Object.freeze(
    Object.fromEntries(Object.entries(source).filter(([field]) => STUDENT_FIELDS.has(field))),
  );
}

function resultFromExisting(conversion) {
  if (!conversion.personId || !conversion.personProfileId || conversion.status !== "COMPLETED") {
    throw crmError(
      "CRM Lead student conversion conflict.",
      CRM_LEAD_STUDENT_CONVERSION_ERROR_CODES.CONFLICT,
      409,
    );
  }
  return Object.freeze({
    conversionStatus: "COMPLETED",
    leadId: conversion.leadId,
    personId: conversion.personId,
    personProfileId: conversion.personProfileId,
    resolutions: Object.freeze({ person: "FOUND", profile: "FOUND" }),
    reused: Object.freeze({ person: true, profile: true }),
  });
}

function isCanonicalStudentError(error) {
  return new Set([
    "PERSON_IDENTITY_CONFLICT",
    "PERSON_IDENTITY_REQUIRED",
    "PERSON_CREATION_FAILED",
    "STUDENT_PROFILE_CONFLICT",
    "PROFILE_CREATION_FAILED",
    "STUDENT_DATA_INCOMPLETE",
    "PERSON_CPF_INVALID",
  ]).has(error?.code);
}
function crmError(message, code, statusCode, details = null) {
  return Object.assign(new Error(message), { code, details, expose: statusCode < 500, statusCode });
}
function text(value) {
  const normalized = String(value ?? "").trim();
  return normalized || "";
}

module.exports = {
  CRM_LEAD_STUDENT_CONVERSION_ERROR_CODES,
  CrmLeadStudentConversionService,
  STUDENT_FIELDS,
  isCanonicalStudentError,
  prepareStudentData,
  resultFromExisting,
};
