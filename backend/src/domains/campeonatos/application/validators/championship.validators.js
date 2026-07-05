const { ChampionshipStatus } = require("../../shared/enums/index.js");
const {
  controlledError,
  normalizeChampionshipStatus,
  normalizeDate,
  normalizeDateRange,
  normalizeLimit,
  nullableText,
  readObject,
  requiredText,
  text,
} = require("../../shared/utils/index.js");

function validateCreateChampionshipInput(input = {}) {
  const name = requiredText(input.name || input.nome, "name", 191);
  const category = requiredText(input.category || input.categoria, "category", 120);
  const modality = requiredText(input.modality || input.modalidade, "modality", 120);
  const startDate = normalizeDate(
    input.startDate || input.dataInicial || input.start_date,
    "startDate",
    {
      required: true,
    },
  );
  const endDate = normalizeDate(input.endDate || input.dataFinal || input.end_date, "endDate", {
    required: true,
  });

  normalizeDateRange(startDate, endDate);

  return {
    category,
    description: nullableText(input.description || input.descricao, 2000),
    endDate,
    metadata: normalizeMetadataWithLogo(input),
    modality,
    name,
    startDate,
    status: normalizeChampionshipStatus(input.status, ChampionshipStatus.DRAFT),
  };
}

function validateUpdateChampionshipInput(input = {}) {
  const output = {};

  if (hasField(input, "name", "nome")) {
    output.name = requiredText(input.name || input.nome, "name", 191);
  }

  if (hasField(input, "category", "categoria")) {
    output.category = requiredText(input.category || input.categoria, "category", 120);
  }

  if (hasField(input, "modality", "modalidade")) {
    output.modality = requiredText(input.modality || input.modalidade, "modality", 120);
  }

  if (hasField(input, "description", "descricao")) {
    output.description = nullableText(input.description || input.descricao, 2000);
  }

  if (hasField(input, "metadata", "logo")) {
    output.metadata = normalizeMetadataWithLogo(input);
  }

  if (hasField(input, "status")) {
    output.status = normalizeChampionshipStatus(input.status);
  }

  if (hasField(input, "startDate", "dataInicial", "start_date")) {
    output.startDate = normalizeDate(
      input.startDate || input.dataInicial || input.start_date,
      "startDate",
      {
        required: true,
      },
    );
  }

  if (hasField(input, "endDate", "dataFinal", "end_date")) {
    output.endDate = normalizeDate(input.endDate || input.dataFinal || input.end_date, "endDate", {
      required: true,
    });
  }

  normalizeDateRange(output.startDate, output.endDate);

  return output;
}

function validateChampionshipListInput(input = {}) {
  return {
    limit: normalizeLimit(input.limit, 100),
    search: text(input.search || input.q, 80),
    status: input.status ? normalizeChampionshipStatus(input.status) : null,
  };
}

function validateChampionshipId(id) {
  return requiredText(id, "championshipId", 64);
}

function hasField(source, ...keys) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(source, key));
}

function normalizeMetadataWithLogo(input = {}) {
  const metadata = readObject(input.metadata);
  const hasTopLevelLogo = hasField(input, "logo");
  const hasMetadataLogo = hasField(metadata, "logo");

  if (!hasTopLevelLogo && !hasMetadataLogo) {
    return metadata;
  }

  return {
    ...metadata,
    logo: normalizeChampionshipLogo(hasTopLevelLogo ? input.logo : metadata.logo),
  };
}

function normalizeChampionshipLogo(value) {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  const source = readObject(value);

  if (Object.keys(source).length === 0) {
    return null;
  }

  rejectLogoUploadPayload(source);

  const logo = {
    checksum: nullableText(source.checksum, 191),
    fileId: nullableText(source.fileId || source.file_id || source.id || source.logoId, 64),
    id: nullableText(source.id || source.logoId || source.fileId || source.file_id, 64),
    mimeType: nullableText(source.mimeType || source.mime_type, 120),
    originalName: nullableText(source.originalName || source.fileName || source.filename, 191),
    publicUrl: nullableText(
      source.publicUrl || source.public_url || source.url || source.logoUrl,
      500,
    ),
    sizeBytes: normalizeLogoSize(source.sizeBytes || source.size_bytes || source.size),
    storageKey: nullableText(source.storageKey || source.storage_key, 191),
    uploadedAt: nullableText(source.uploadedAt || source.uploaded_at, 64),
    uploadedBy: nullableText(source.uploadedBy || source.uploaded_by, 191),
  };

  return Object.values(logo).some((fieldValue) => fieldValue !== null) ? logo : null;
}

function rejectLogoUploadPayload(source = {}) {
  const blockedFields = ["base64", "binary", "blob", "buffer", "data", "dataUrl", "file", "files"];

  for (const fieldName of blockedFields) {
    if (Object.prototype.hasOwnProperty.call(source, fieldName) && source[fieldName]) {
      throw controlledError(
        "Upload de logo ainda nao esta disponivel para campeonatos.",
        "CHAMPIONSHIP_LOGO_UPLOAD_NOT_AVAILABLE",
        400,
        { field: `logo.${fieldName}` },
      );
    }
  }
}

function normalizeLogoSize(value) {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

module.exports = {
  normalizeChampionshipLogo,
  validateChampionshipId,
  validateChampionshipListInput,
  validateCreateChampionshipInput,
  validateUpdateChampionshipInput,
};
