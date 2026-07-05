const { TEAM_STATUSES, TeamStatus } = require("../enums/index.js");
const { controlledError, nullableText, readObject, text } = require("./championship-normalizers.js");

function normalizeTeamStatus(value, fallback = TeamStatus.ACTIVE) {
  const normalized = text(value, 32)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-\s]+/g, "_")
    .toUpperCase();

  if (!normalized) return fallback;
  if (["ATIVA", "ATIVO", "ACTIVE"].includes(normalized)) return TeamStatus.ACTIVE;
  if (["INATIVA", "INATIVO", "INACTIVE"].includes(normalized)) return TeamStatus.INACTIVE;
  if (["DESCLASSIFICADA", "DESCLASSIFICADO", "DISQUALIFIED"].includes(normalized)) {
    return TeamStatus.DISQUALIFIED;
  }

  if (TEAM_STATUSES.includes(normalized)) return normalized;

  throw controlledError("Status de equipe invalido.", "CHAMPIONSHIP_TEAM_STATUS_INVALID", 400, {
    status: value,
  });
}

function normalizeTeamShield(value) {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  const source = readObject(value);

  if (Object.keys(source).length === 0) {
    return null;
  }

  rejectShieldUploadPayload(source);

  const shield = {
    checksum: nullableText(source.checksum, 191),
    fileId: nullableText(
      source.fileId || source.file_id || source.id || source.shieldId || source.logoId,
      64,
    ),
    id: nullableText(
      source.id || source.shieldId || source.logoId || source.fileId || source.file_id,
      64,
    ),
    mimeType: nullableText(source.mimeType || source.mime_type, 120),
    originalName: nullableText(source.originalName || source.fileName || source.filename, 191),
    publicUrl: nullableText(
      source.publicUrl || source.public_url || source.url || source.logoUrl || source.shieldUrl,
      500,
    ),
    sizeBytes: normalizeShieldSize(source.sizeBytes || source.size_bytes || source.size),
    storageKey: nullableText(source.storageKey || source.storage_key, 191),
    uploadedAt: nullableText(source.uploadedAt || source.uploaded_at, 64),
    uploadedBy: nullableText(source.uploadedBy || source.uploaded_by, 191),
  };

  return Object.values(shield).some((fieldValue) => fieldValue !== null) ? shield : null;
}

function normalizeTechnicalCommission(value) {
  if (!value) return [];
  const source = Array.isArray(value) ? value : readObject(value).items;
  if (!Array.isArray(source)) return [];

  return source
    .map((member) => {
      const item = readObject(member);
      return {
        name: nullableText(item.name || item.nome, 191),
        role: nullableText(item.role || item.funcao, 120),
        phone: nullableText(item.phone || item.telefone, 80),
        email: nullableText(item.email, 191),
      };
    })
    .filter((member) => member.name || member.role || member.phone || member.email);
}

function rejectShieldUploadPayload(source = {}) {
  const blockedFields = ["base64", "binary", "blob", "buffer", "data", "dataUrl", "file", "files"];

  for (const fieldName of blockedFields) {
    if (Object.prototype.hasOwnProperty.call(source, fieldName) && source[fieldName]) {
      throw controlledError(
        "Upload de escudo ainda nao esta disponivel para equipes.",
        "CHAMPIONSHIP_TEAM_SHIELD_UPLOAD_NOT_AVAILABLE",
        400,
        { field: `shield.${fieldName}` },
      );
    }
  }
}

function normalizeShieldSize(value) {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

module.exports = {
  normalizeTeamShield,
  normalizeTeamStatus,
  normalizeTechnicalCommission,
};
