const { randomUUID } = require("node:crypto");

const {
  PaymentChargeEntity,
  PaymentChargeStatus,
  normalizeAmount,
  normalizeCurrency,
  normalizeDate,
  normalizePaymentChargeStatus,
  normalizePaymentMethod,
  normalizePaymentProviderId,
  nullableText,
  readObject,
} = require("../../entities/payment.entity.js");

const PAYMENT_CHARGES_TABLE = "financial_gateway_charges";

const CREATE_PAYMENT_CHARGES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${PAYMENT_CHARGES_TABLE} (
    id VARCHAR(64) PRIMARY KEY,
    legacy_charge_id VARCHAR(64) NULL,
    mensalidade_id VARCHAR(64) NULL,
    student_id VARCHAR(64) NOT NULL,
    responsible_id VARCHAR(64) NULL,
    provider VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    description VARCHAR(191) NOT NULL,
    due_date DATE NULL,
    payment_method VARCHAR(50) NULL,
    external_id VARCHAR(191) NULL,
    checkout_url VARCHAR(1000) NULL,
    provider_payload LONGTEXT NULL,
    metadata_json LONGTEXT NULL,
    created_by VARCHAR(191) NULL,
    updated_by VARCHAR(191) NULL,
    cancelled_by VARCHAR(191) NULL,
    cancellation_reason TEXT NULL,
    cancelled_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_financial_gateway_charges_student (student_id),
    INDEX idx_financial_gateway_charges_provider (provider),
    INDEX idx_financial_gateway_charges_status (status),
    INDEX idx_financial_gateway_charges_due_date (due_date),
    INDEX idx_financial_gateway_charges_legacy (legacy_charge_id),
    INDEX idx_financial_gateway_charges_mensalidade (mensalidade_id)
  )
`;

const INSERT_PAYMENT_CHARGE_SQL = `
  INSERT INTO ${PAYMENT_CHARGES_TABLE} (
    id,
    legacy_charge_id,
    mensalidade_id,
    student_id,
    responsible_id,
    provider,
    status,
    amount,
    currency,
    description,
    due_date,
    payment_method,
    external_id,
    checkout_url,
    provider_payload,
    metadata_json,
    created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SELECT_PAYMENT_CHARGE_BY_ID_SQL = `
  SELECT *
  FROM ${PAYMENT_CHARGES_TABLE}
  WHERE id = ?
  LIMIT 1
`;

const CANCEL_PAYMENT_CHARGE_SQL = `
  UPDATE ${PAYMENT_CHARGES_TABLE}
  SET
    status = ?,
    cancelled_by = ?,
    cancellation_reason = ?,
    cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP),
    provider_payload = ?,
    updated_by = ?,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`;

class MySqlPaymentRepository {
  constructor(options = {}) {
    this.query = options.queryRunner || getDefaultQueryRunner();
    this.idGenerator = options.idGenerator || defaultIdGenerator;
    this.schemaReady = false;
  }

  async ensureSchema() {
    if (this.schemaReady) return;
    await this.query(CREATE_PAYMENT_CHARGES_TABLE_SQL);
    this.schemaReady = true;
  }

  async createCharge(input = {}) {
    await this.ensureSchema();

    const values = normalizeCreateInput(input, this.idGenerator);
    await this.query(INSERT_PAYMENT_CHARGE_SQL, [
      values.id,
      values.legacyChargeId,
      values.mensalidadeId,
      values.studentId,
      values.responsibleId,
      values.provider,
      values.status,
      values.amount,
      values.currency,
      values.description,
      values.dueDate,
      values.paymentMethod,
      values.externalId,
      values.checkoutUrl,
      safeJsonStringify(values.providerPayload),
      safeJsonStringify(values.metadata),
      values.createdBy,
    ]);

    return this.findChargeById(values.id);
  }

  async listCharges(input = {}) {
    await this.ensureSchema();

    const filters = [];
    const params = [];

    if (input.provider) {
      filters.push("provider = ?");
      params.push(normalizePaymentProviderId(input.provider));
    }

    if (input.status) {
      filters.push("status = ?");
      params.push(normalizePaymentChargeStatus(input.status));
    }

    if (input.studentId) {
      filters.push("student_id = ?");
      params.push(nullableText(input.studentId, 64));
    }

    const limit = normalizeLimit(input.limit, 100);
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = await this.query(
      `
        SELECT *
        FROM ${PAYMENT_CHARGES_TABLE}
        ${where}
        ORDER BY due_date ASC, created_at DESC, id DESC
        LIMIT ?
      `,
      [...params, limit],
    );

    const charges = readRows(rows).map(mapPaymentChargeRow).filter(Boolean);

    return {
      items: charges,
      total: charges.length,
    };
  }

  async findChargeById(id) {
    await this.ensureSchema();

    const rows = await this.query(SELECT_PAYMENT_CHARGE_BY_ID_SQL, [requiredText(id, "id", 64)]);

    return mapPaymentChargeRow(readFirstRow(rows));
  }

  async updateCharge(input = {}) {
    await this.ensureSchema();

    const id = requiredText(input.id, "id", 64);
    const values = normalizePatchInput(input.patch || {});
    const assignments = [];
    const params = [];

    addAssignment(assignments, params, "legacy_charge_id", values.legacyChargeId);
    addAssignment(assignments, params, "mensalidade_id", values.mensalidadeId);
    addAssignment(assignments, params, "responsible_id", values.responsibleId);
    addAssignment(assignments, params, "provider", values.provider);
    addAssignment(assignments, params, "status", values.status);
    addAssignment(assignments, params, "amount", values.amount);
    addAssignment(assignments, params, "currency", values.currency);
    addAssignment(assignments, params, "description", values.description);
    addAssignment(assignments, params, "due_date", values.dueDate);
    addAssignment(assignments, params, "payment_method", values.paymentMethod);
    addAssignment(assignments, params, "external_id", values.externalId);
    addAssignment(assignments, params, "checkout_url", values.checkoutUrl);

    if (values.providerPayload !== undefined) {
      addAssignment(
        assignments,
        params,
        "provider_payload",
        safeJsonStringify(values.providerPayload),
      );
    }

    if (values.metadata !== undefined) {
      addAssignment(assignments, params, "metadata_json", safeJsonStringify(values.metadata));
    }

    addAssignment(assignments, params, "updated_by", nullableText(input.updatedBy, 191));

    if (assignments.length === 0) {
      return this.findChargeById(id);
    }

    await this.query(
      `
        UPDATE ${PAYMENT_CHARGES_TABLE}
        SET
          ${assignments.join(",\n          ")},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [...params, id],
    );

    return this.findChargeById(id);
  }

  async cancelCharge(input = {}) {
    await this.ensureSchema();

    const id = requiredText(input.id, "id", 64);
    await this.query(CANCEL_PAYMENT_CHARGE_SQL, [
      PaymentChargeStatus.CANCELLED,
      nullableText(input.cancelledBy, 191),
      nullableText(input.reason, 65535),
      safeJsonStringify(input.providerPayload || null),
      nullableText(input.cancelledBy, 191),
      id,
    ]);

    return this.findChargeById(id);
  }

  async deleteCharge(input = {}) {
    return this.cancelCharge(input);
  }
}

function normalizeCreateInput(input = {}, idGenerator = defaultIdGenerator) {
  return {
    amount: normalizeAmount(input.amount),
    checkoutUrl: nullableText(input.checkoutUrl, 1000),
    createdBy: nullableText(input.createdBy ?? input.requestedBy, 191),
    currency: normalizeCurrency(input.currency),
    description: requiredText(input.description, "description", 191),
    dueDate: normalizeDate(input.dueDate),
    externalId: nullableText(input.externalId, 191),
    id: nullableText(input.id, 64) || idGenerator("fgc"),
    legacyChargeId: nullableText(input.legacyChargeId, 64),
    mensalidadeId: nullableText(input.mensalidadeId, 64),
    metadata: readObject(input.metadata),
    paymentMethod: normalizePaymentMethod(input.paymentMethod),
    provider: normalizePaymentProviderId(input.provider),
    providerPayload: readObject(input.providerPayload),
    responsibleId: nullableText(input.responsibleId, 64),
    status: normalizePaymentChargeStatus(input.status),
    studentId: requiredText(input.studentId, "studentId", 64),
  };
}

function normalizePatchInput(input = {}) {
  const values = {};

  if (hasOwn(input, "legacyChargeId"))
    values.legacyChargeId = nullableText(input.legacyChargeId, 64);
  if (hasOwn(input, "mensalidadeId")) values.mensalidadeId = nullableText(input.mensalidadeId, 64);
  if (hasOwn(input, "responsibleId")) values.responsibleId = nullableText(input.responsibleId, 64);
  if (hasOwn(input, "provider")) values.provider = normalizePaymentProviderId(input.provider);
  if (hasOwn(input, "status")) values.status = normalizePaymentChargeStatus(input.status);
  if (hasOwn(input, "amount")) values.amount = normalizeAmount(input.amount);
  if (hasOwn(input, "currency")) values.currency = normalizeCurrency(input.currency);
  if (hasOwn(input, "description")) values.description = nullableText(input.description, 191);
  if (hasOwn(input, "dueDate")) values.dueDate = normalizeDate(input.dueDate);
  if (hasOwn(input, "paymentMethod")) {
    values.paymentMethod = normalizePaymentMethod(input.paymentMethod);
  }
  if (hasOwn(input, "externalId")) values.externalId = nullableText(input.externalId, 191);
  if (hasOwn(input, "checkoutUrl")) values.checkoutUrl = nullableText(input.checkoutUrl, 1000);
  if (hasOwn(input, "providerPayload")) values.providerPayload = readObject(input.providerPayload);
  if (hasOwn(input, "metadata")) values.metadata = readObject(input.metadata);

  return values;
}

function mapPaymentChargeRow(row) {
  if (!row || typeof row !== "object") return null;

  return new PaymentChargeEntity({
    amount: row.amount,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    cancellationReason: row.cancellation_reason,
    checkoutUrl: row.checkout_url,
    createdAt: row.created_at,
    createdBy: row.created_by,
    currency: row.currency,
    description: row.description,
    dueDate: row.due_date,
    externalId: row.external_id,
    id: row.id,
    legacyChargeId: row.legacy_charge_id,
    mensalidadeId: row.mensalidade_id,
    metadata: parseJson(row.metadata_json, {}),
    paymentMethod: row.payment_method,
    provider: row.provider,
    providerPayload: parseJson(row.provider_payload, {}),
    responsibleId: row.responsible_id,
    status: row.status,
    studentId: row.student_id,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }).toJSON();
}

function addAssignment(assignments, params, column, value) {
  if (value === undefined) return;
  assignments.push(`${column} = ?`);
  params.push(value);
}

function readFirstRow(result) {
  const rows = readRows(result);
  return rows[0] && typeof rows[0] === "object" ? rows[0] : null;
}

function readRows(result) {
  if (!Array.isArray(result)) return [];
  if (Array.isArray(result[0])) return result[0];
  return result;
}

function normalizeLimit(value, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(50, max);
  }

  return Math.min(Math.trunc(parsed), max);
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return JSON.stringify({ error: "payload_nao_serializavel" });
  }
}

function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);

  if (!normalized) {
    throw new TypeError(`MySqlPaymentRepository requires ${field}.`);
  }

  return normalized;
}

function hasOwn(input, key) {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function defaultIdGenerator(prefix) {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function getDefaultQueryRunner() {
  return require("../../../../../config/db.js").query;
}

module.exports = {
  CREATE_PAYMENT_CHARGES_TABLE_SQL,
  CANCEL_PAYMENT_CHARGE_SQL,
  INSERT_PAYMENT_CHARGE_SQL,
  MySqlPaymentRepository,
  PAYMENT_CHARGES_TABLE,
  SELECT_PAYMENT_CHARGE_BY_ID_SQL,
  mapPaymentChargeRow,
};
