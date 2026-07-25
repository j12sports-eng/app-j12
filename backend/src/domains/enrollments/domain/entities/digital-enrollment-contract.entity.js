const { createHash } = require("node:crypto");

const TEMPLATE_STATUSES = Object.freeze(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const CONTRACT_STATUSES = Object.freeze(["PENDING_ACCEPTANCE", "ACCEPTED", "SUPERSEDED", "CANCELLED"]);
const ACCEPTANCE_METHODS = Object.freeze(["ELECTRONIC_CONFIRMATION"]);
const CONTENT_FORMATS = Object.freeze(["HTML_SANITIZED"]);
const CONSENT_CODES = Object.freeze(["CONTRACT_TERMS"]);

class DigitalEnrollmentContractTemplate {
  constructor(input = {}) {
    this.id = required(input.id, "id");
    this.unitId = required(input.unitId, "unitId");
    this.name = required(input.name, "name");
    this.version = required(input.version, "version");
    this.status = allowed(input.status || "DRAFT", TEMPLATE_STATUSES, "status");
    this.contentFormat = allowed(input.contentFormat || "HTML_SANITIZED", CONTENT_FORMATS, "contentFormat");
    this.content = sanitizeContractHtml(input.content);
    this.contentHash = stableContentHash(this.content);
    this.schemaVersion = positive(input.schemaVersion || 1, "schemaVersion");
    this.effectiveFrom = input.effectiveFrom || null;
    this.effectiveUntil = input.effectiveUntil || null;
    this.publishedAt = input.publishedAt || null;
    this.publishedByAuthIdentityId = input.publishedByAuthIdentityId || null;
    Object.freeze(this);
  }
}

class DigitalEnrollmentContract {
  constructor(input = {}) {
    this.id = required(input.id, "id");
    this.enrollmentId = required(input.enrollmentId, "enrollmentId");
    this.templateId = required(input.templateId, "templateId");
    this.templateVersion = required(input.templateVersion, "templateVersion");
    this.responsibleRelationshipId = required(input.responsibleRelationshipId, "responsibleRelationshipId");
    this.status = allowed(input.status || "PENDING_ACCEPTANCE", CONTRACT_STATUSES, "status");
    this.contentSnapshot = sanitizeContractHtml(input.contentSnapshot);
    this.contentHash = stableContentHash(this.contentSnapshot);
    this.generatedAt = required(input.generatedAt, "generatedAt");
    this.expiresAt = input.expiresAt || null;
    this.acceptedAt = input.acceptedAt || null;
    Object.freeze(this);
  }
}

class DigitalEnrollmentContractAcceptance {
  constructor(input = {}) {
    this.id = required(input.id, "id");
    this.enrollmentContractId = required(input.enrollmentContractId, "enrollmentContractId");
    this.enrollmentId = required(input.enrollmentId, "enrollmentId");
    this.responsibleRelationshipId = required(input.responsibleRelationshipId, "responsibleRelationshipId");
    this.invitationId = required(input.invitationId, "invitationId");
    this.contentHash = hash(input.contentHash);
    this.acceptedAt = required(input.acceptedAt, "acceptedAt");
    this.acceptanceMethod = allowed(input.acceptanceMethod || "ELECTRONIC_CONFIRMATION", ACCEPTANCE_METHODS, "acceptanceMethod");
    this.termsVersion = required(input.termsVersion, "termsVersion");
    this.consents = validateConsents(input.consents, input.acceptedAt);
    this.requestId = input.requestId || null;
    this.correlationId = input.correlationId || null;
    this.ipHash = input.ipHash ? hash(input.ipHash) : null;
    this.userAgentHash = input.userAgentHash ? hash(input.userAgentHash) : null;
    Object.freeze(this);
  }
}

function sanitizeContractHtml(value) {
  const content = String(value || "").trim();
  if (!content) throw invalid("content");
  const forbidden = /<\s*(script|iframe|object|embed|style|link|meta)\b|on[a-z]+\s*=|javascript\s*:|data\s*:|url\s*\(|@import|src\s*=\s*["']?\s*https?:/i;
  if (forbidden.test(content)) throw invalid("content");
  return content.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n");
}
function stableContentHash(content) { return createHash("sha256").update(sanitizeContractHtml(content), "utf8").digest("hex"); }
function validateConsents(values, acceptedAt) {
  if (!Array.isArray(values)) throw invalid("consents");
  const seen = new Set();
  const result = values.map((item) => {
    if (!CONSENT_CODES.includes(item?.code) || seen.has(item.code)) throw invalid("consents");
    seen.add(item.code);
    if (item.accepted !== true || !item.version) throw invalid("consents");
    return Object.freeze({ code: item.code, version: String(item.version), required: true, accepted: true, acceptedAt: item.acceptedAt || acceptedAt });
  });
  if (!seen.has("CONTRACT_TERMS")) throw invalid("consents");
  return Object.freeze(result);
}
function required(value, field) { const result = String(value || "").trim(); if (!result) throw invalid(field); return result; }
function allowed(value, values, field) { if (!values.includes(value)) throw invalid(field); return value; }
function positive(value, field) { const result = Number(value); if (!Number.isSafeInteger(result) || result < 1) throw invalid(field); return result; }
function hash(value) { const result = String(value || ""); if (!/^[a-f0-9]{64}$/.test(result)) throw invalid("hash"); return result; }
function invalid(field) { return new TypeError(`${field} is invalid.`); }

module.exports = {
  ACCEPTANCE_METHODS, CONSENT_CODES, CONTENT_FORMATS, CONTRACT_STATUSES, DigitalEnrollmentContract,
  DigitalEnrollmentContractAcceptance, DigitalEnrollmentContractTemplate, TEMPLATE_STATUSES,
  sanitizeContractHtml, stableContentHash, validateConsents,
};
