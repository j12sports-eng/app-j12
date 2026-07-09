const crypto = require("node:crypto");

const {
  FinancialAutomationEventEntity,
  FinancialAutomationEventStatus,
  nullableText,
} = require("../../entities/financial-automation-event.entity.js");

const FINANCIAL_AUTOMATION_EVENTS_TABLE = "financial_automation_events";

const CREATE_FINANCIAL_AUTOMATION_EVENTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${FINANCIAL_AUTOMATION_EVENTS_TABLE} (
    id VARCHAR(64) PRIMARY KEY,
    event_key VARCHAR(191) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    channel VARCHAR(32) NULL,
    provider VARCHAR(64) NULL,
    process_run_id VARCHAR(64) NULL,
    reference_date DATE NULL,
    days_offset INT NULL,
    occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    error_message TEXT NULL,
    payload_json LONGTEXT NULL,
    created_by VARCHAR(191) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_financial_automation_events_key (event_key),
    INDEX idx_financial_automation_events_target (target_type, target_id),
    INDEX idx_financial_automation_events_type_status (event_type, status),
    INDEX idx_financial_automation_events_reference (reference_date)
  )
`;

const SELECT_AUTOMATION_EVENT_BY_KEY_SQL = `
  SELECT *
  FROM ${FINANCIAL_AUTOMATION_EVENTS_TABLE}
  WHERE event_key = ?
  LIMIT 1
`;

const SELECT_AUTOMATION_EVENT_BY_ID_SQL = `
  SELECT *
  FROM ${FINANCIAL_AUTOMATION_EVENTS_TABLE}
  WHERE id = ?
  LIMIT 1
`;

const INSERT_AUTOMATION_EVENT_SQL = `
  INSERT IGNORE INTO ${FINANCIAL_AUTOMATION_EVENTS_TABLE} (
    id,
    event_key,
    event_type,
    target_type,
    target_id,
    status,
    channel,
    provider,
    process_run_id,
    reference_date,
    days_offset,
    occurred_at,
    completed_at,
    error_message,
    payload_json,
    created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

class MySqlFinancialAutomationRepository {
  constructor(options = {}) {
    this.query = options.queryRunner || getDefaultQueryRunner();
    this.idGenerator = options.idGenerator || buildStableId;
    this.schemaReady = false;
  }

  async ensureSchema() {
    if (this.schemaReady) return;
    await this.query(CREATE_FINANCIAL_AUTOMATION_EVENTS_TABLE_SQL);
    this.schemaReady = true;
  }

  async findUpcomingInstallments(input = {}) {
    const targetDates = buildTargetDates(input.referenceDate, input.days, 1);
    if (targetDates.length === 0) return [];

    const rows = await this.query(
      `
        SELECT
          m.id AS mensalidade_id,
          m.cobranca_id,
          m.aluno_id,
          m.referencia,
          m.valor,
          m.data_vencimento,
          m.status,
          c.descricao,
          c.nome_aluno,
          c.responsavel_financeiro,
          c.telefone_whatsapp,
          c.email,
          c.valor_final,
          a.nome_completo,
          a.email_contato,
          a.telefone_contato,
          a.responsavel_id,
          r.nome AS responsavel_nome,
          r.telefone AS responsavel_telefone,
          r.email AS responsavel_email
        FROM j12_mensalidades m
        LEFT JOIN j12_financeiro_cobrancas c
          ON CAST(c.id AS CHAR) = CAST(m.cobranca_id AS CHAR)
        LEFT JOIN j12_alunos a
          ON CAST(a.id AS CHAR) = CAST(m.aluno_id AS CHAR)
        LEFT JOIN j12_responsaveis r
          ON CAST(r.id AS CHAR) = CAST(a.responsavel_id AS CHAR)
        WHERE m.status = 'pendente'
          AND m.data_vencimento IN (${targetDates.map(() => "?").join(", ")})
        ORDER BY m.data_vencimento ASC, m.id ASC
        LIMIT ?
      `,
      [...targetDates, normalizeLimit(input.limit, 200)],
    );

    return readRows(rows).map((row) => mapInstallmentRow(row, input.referenceDate));
  }

  async findOverdueInstallments(input = {}) {
    const targetDates = buildTargetDates(input.referenceDate, input.days, -1);
    if (targetDates.length === 0) return [];

    const rows = await this.query(
      `
        SELECT
          m.id AS mensalidade_id,
          m.cobranca_id,
          m.aluno_id,
          m.referencia,
          m.valor,
          m.data_vencimento,
          m.status,
          c.descricao,
          c.nome_aluno,
          c.responsavel_financeiro,
          c.telefone_whatsapp,
          c.email,
          c.valor_final,
          a.nome_completo,
          a.email_contato,
          a.telefone_contato,
          a.responsavel_id,
          r.nome AS responsavel_nome,
          r.telefone AS responsavel_telefone,
          r.email AS responsavel_email
        FROM j12_mensalidades m
        LEFT JOIN j12_financeiro_cobrancas c
          ON CAST(c.id AS CHAR) = CAST(m.cobranca_id AS CHAR)
        LEFT JOIN j12_alunos a
          ON CAST(a.id AS CHAR) = CAST(m.aluno_id AS CHAR)
        LEFT JOIN j12_responsaveis r
          ON CAST(r.id AS CHAR) = CAST(a.responsavel_id AS CHAR)
        WHERE m.status IN ('pendente', 'atrasado')
          AND m.data_vencimento IN (${targetDates.map(() => "?").join(", ")})
        ORDER BY m.data_vencimento ASC, m.id ASC
        LIMIT ?
      `,
      [...targetDates, normalizeLimit(input.limit, 200)],
    );

    return readRows(rows).map((row) => mapInstallmentRow(row, input.referenceDate));
  }

  async findPayments(input = {}) {
    const statuses = Array.isArray(input.statuses) ? input.statuses.filter(Boolean) : [];
    const filters = [];
    const params = [];

    if (statuses.length > 0) {
      filters.push(`p.status IN (${statuses.map(() => "?").join(", ")})`);
      params.push(...statuses);
    }

    if (input.id || input.paymentId) {
      filters.push("(p.id = ? OR p.txid = ?)");
      params.push(String(input.id || input.paymentId), String(input.id || input.paymentId));
    }

    const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = await this.query(
      `
        SELECT
          p.*,
          m.status AS mensalidade_status,
          m.data_vencimento,
          c.nome_aluno,
          c.responsavel_financeiro,
          c.telefone_whatsapp,
          c.email,
          a.nome_completo,
          a.email_contato,
          a.telefone_contato,
          a.responsavel_id,
          r.nome AS responsavel_nome,
          r.telefone AS responsavel_telefone,
          r.email AS responsavel_email
        FROM financial_payments p
        LEFT JOIN j12_mensalidades m
          ON CAST(m.id AS CHAR) = CAST(p.mensalidade_id AS CHAR)
        LEFT JOIN j12_financeiro_cobrancas c
          ON CAST(c.id AS CHAR) = CAST(COALESCE(p.charge_id, m.cobranca_id) AS CHAR)
        LEFT JOIN j12_alunos a
          ON CAST(a.id AS CHAR) = CAST(COALESCE(p.student_id, m.aluno_id) AS CHAR)
        LEFT JOIN j12_responsaveis r
          ON CAST(r.id AS CHAR) = CAST(COALESCE(p.responsible_id, a.responsavel_id) AS CHAR)
        ${where}
        ORDER BY COALESCE(p.paid_at, p.due_date, p.created_at) DESC, p.id DESC
        LIMIT ?
      `,
      [...params, normalizeLimit(input.limit, 200)],
    );

    return readRows(rows).map(mapPaymentRow);
  }

  async findAutomationEventsByKeys(keys = []) {
    const uniqueKeys = Array.from(
      new Set(keys.map((key) => nullableText(key, 191)).filter(Boolean)),
    );
    if (uniqueKeys.length === 0) return [];

    await this.ensureSchema();
    const rows = await this.query(
      `
        SELECT *
        FROM ${FINANCIAL_AUTOMATION_EVENTS_TABLE}
        WHERE event_key IN (${uniqueKeys.map(() => "?").join(", ")})
      `,
      uniqueKeys,
    );

    return readRows(rows).map(mapAutomationEventRow).filter(Boolean);
  }

  async recordAutomationEvent(input = {}) {
    await this.ensureSchema();

    const event = new FinancialAutomationEventEntity(input);
    const eventKey = requiredText(event.eventKey, "eventKey", 191);
    const id = event.id || this.idGenerator("fae", eventKey);
    const result = await this.query(INSERT_AUTOMATION_EVENT_SQL, [
      id,
      eventKey,
      requiredText(event.eventType, "eventType", 64),
      requiredText(event.targetType, "targetType", 32),
      requiredText(event.targetId, "targetId", 64),
      requiredText(event.status, "status", 32),
      event.channel,
      event.provider,
      event.processRunId,
      event.referenceDate,
      event.daysOffset,
      event.occurredAt || nowMysql(),
      event.status === FinancialAutomationEventStatus.COMPLETED
        ? event.occurredAt || nowMysql()
        : null,
      event.errorMessage,
      safeJsonStringify(event.payload),
      event.createdBy,
    ]);
    const saved = await this.findAutomationEventByKey(eventKey);
    const mutation = readMutationResult(result);
    const created = Number(mutation?.affectedRows || 0) === 1;

    return {
      created,
      event: saved,
      reused: !created,
    };
  }

  async findAutomationEventByKey(eventKey) {
    await this.ensureSchema();
    const rows = await this.query(SELECT_AUTOMATION_EVENT_BY_KEY_SQL, [
      requiredText(eventKey, "eventKey", 191),
    ]);

    return mapAutomationEventRow(readRows(rows)[0]);
  }

  async findAutomationEventById(id) {
    await this.ensureSchema();
    const rows = await this.query(SELECT_AUTOMATION_EVENT_BY_ID_SQL, [requiredText(id, "id", 64)]);

    return mapAutomationEventRow(readRows(rows)[0]);
  }

  async markPendingEventsCompletedForPaidPayments(input = {}) {
    await this.ensureSchema();

    const identifiers = collectPaymentTargetIds(input.payments);
    if (identifiers.length === 0) {
      return { completed: 0 };
    }

    const result = await this.query(
      `
        UPDATE ${FINANCIAL_AUTOMATION_EVENTS_TABLE}
        SET
          status = 'COMPLETED',
          completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
          process_run_id = COALESCE(?, process_run_id),
          updated_at = CURRENT_TIMESTAMP
        WHERE status = 'PENDING'
          AND target_id IN (${identifiers.map(() => "?").join(", ")})
      `,
      [nullableText(input.processRunId, 64), ...identifiers],
    );
    const mutation = readMutationResult(result);

    return {
      completed: Number(mutation?.affectedRows || mutation?.changedRows || 0),
    };
  }

  async resetEventForReprocess(input = {}) {
    await this.ensureSchema();

    const filters = [];
    const params = [];

    if (input.eventId) {
      filters.push("id = ?");
      params.push(requiredText(input.eventId, "eventId", 64));
    }

    if (input.idempotencyKey) {
      filters.push("event_key = ?");
      params.push(requiredText(input.idempotencyKey, "idempotencyKey", 191));
    }

    if (filters.length === 0) {
      return { event: null, reset: false };
    }

    await this.query(
      `
        UPDATE ${FINANCIAL_AUTOMATION_EVENTS_TABLE}
        SET
          status = 'PENDING',
          completed_at = NULL,
          error_message = NULL,
          process_run_id = COALESCE(?, process_run_id),
          updated_at = CURRENT_TIMESTAMP
        WHERE ${filters.join(" OR ")}
      `,
      [nullableText(input.processRunId, 64), ...params],
    );

    const event = input.eventId
      ? await this.findAutomationEventById(input.eventId)
      : await this.findAutomationEventByKey(input.idempotencyKey);

    return {
      event,
      reset: Boolean(event),
      requestedBy: nullableText(input.requestedBy, 191),
    };
  }
}

function mapInstallmentRow(row, referenceDate) {
  const dueDate = dateOnly(row.data_vencimento);

  return {
    amount: normalizeAmount(row.valor_final ?? row.valor),
    chargeId: nullableText(row.cobranca_id, 64),
    competencia: nullableText(row.referencia, 7),
    daysOffset: diffDays(referenceDate, dueDate),
    description: nullableText(row.descricao, 191) || "Mensalidade J12",
    dueDate,
    email: nullableText(row.email ?? row.email_contato, 191),
    id: nullableText(row.mensalidade_id, 64),
    mensalidadeId: nullableText(row.mensalidade_id, 64),
    phone: nullableText(row.telefone_whatsapp ?? row.telefone_contato, 50),
    responsibleEmail: nullableText(row.responsavel_email, 191),
    responsibleId: nullableText(row.responsavel_id, 64),
    responsibleName: nullableText(row.responsavel_financeiro ?? row.responsavel_nome, 191),
    responsiblePhone: nullableText(row.responsavel_telefone, 50),
    status: nullableText(row.status, 32),
    studentId: nullableText(row.aluno_id, 64),
    studentName: nullableText(row.nome_aluno ?? row.nome_completo, 191),
  };
}

function mapPaymentRow(row) {
  return {
    amount: normalizeAmount(row.amount),
    chargeId: nullableText(row.charge_id, 64),
    dueDate: dateOnly(row.due_date ?? row.data_vencimento),
    email: nullableText(row.email ?? row.email_contato, 191),
    id: nullableText(row.id, 64),
    mensalidadeId: nullableText(row.mensalidade_id, 64),
    paidAt: normalizeDateTime(row.paid_at),
    paymentMethod: nullableText(row.payment_method, 50),
    phone: nullableText(row.telefone_whatsapp ?? row.telefone_contato, 50),
    responsibleEmail: nullableText(row.responsavel_email, 191),
    responsibleId: nullableText(row.responsible_id ?? row.responsavel_id, 64),
    responsibleName: nullableText(row.responsavel_financeiro ?? row.responsavel_nome, 191),
    responsiblePhone: nullableText(row.responsavel_telefone, 50),
    status: nullableText(row.status, 32),
    studentId: nullableText(row.student_id, 64),
    studentName: nullableText(row.nome_aluno ?? row.nome_completo, 191),
    txid: nullableText(row.txid, 35),
  };
}

function mapAutomationEventRow(row) {
  if (!row || typeof row !== "object") return null;
  return new FinancialAutomationEventEntity(row).toJSON();
}

function collectPaymentTargetIds(payments = []) {
  const identifiers = [];

  for (const payment of Array.isArray(payments) ? payments : []) {
    for (const value of [payment.id, payment.chargeId, payment.mensalidadeId]) {
      const normalized = nullableText(value, 64);
      if (normalized) identifiers.push(normalized);
    }
  }

  return Array.from(new Set(identifiers));
}

function buildTargetDates(referenceDate, days = [], direction = 1) {
  return Array.from(
    new Set(
      (Array.isArray(days) ? days : [])
        .map((day) => addDays(referenceDate, Number(day) * direction))
        .filter(Boolean),
    ),
  );
}

function addDays(dateText, days) {
  const base = dateOnly(dateText);
  if (!base || !Number.isFinite(days)) return null;

  const date = new Date(`${base}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function diffDays(referenceDate, dueDate) {
  const reference = dateOnly(referenceDate);
  const due = dateOnly(dueDate);
  if (!reference || !due) return null;

  const left = new Date(`${reference}T00:00:00.000Z`);
  const right = new Date(`${due}T00:00:00.000Z`);
  return Math.round((right.getTime() - left.getTime()) / 86_400_000);
}

function dateOnly(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const normalized = nullableText(value, 32);
  return normalized ? normalized.slice(0, 10) : null;
}

function normalizeDateTime(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 19).replace("T", " ");
  }

  const normalized = nullableText(value, 32);
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(normalized || "")) {
    return normalized.replace("T", " ");
  }
  return null;
}

function normalizeAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function normalizeLimit(value, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return Math.min(50, max);
  return Math.min(Math.trunc(parsed), max);
}

function readRows(result) {
  if (!Array.isArray(result)) return [];
  if (Array.isArray(result[0])) return result[0];
  return result;
}

function readMutationResult(result) {
  if (Array.isArray(result)) {
    const first = result[0];
    return first && typeof first === "object" && !Array.isArray(first) ? first : null;
  }
  return result && typeof result === "object" && !Array.isArray(result) ? result : null;
}

function nowMysql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ error: "payload_nao_serializavel" });
  }
}

function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);

  if (!normalized) {
    throw new TypeError(`MySqlFinancialAutomationRepository requires ${field}.`);
  }

  return normalized;
}

function buildStableId(prefix, seed) {
  return `${prefix}-${crypto.createHash("sha1").update(String(seed)).digest("hex").slice(0, 24)}`;
}

function getDefaultQueryRunner() {
  return require("../../../../../config/db.js").query;
}

module.exports = {
  CREATE_FINANCIAL_AUTOMATION_EVENTS_TABLE_SQL,
  FINANCIAL_AUTOMATION_EVENTS_TABLE,
  INSERT_AUTOMATION_EVENT_SQL,
  MySqlFinancialAutomationRepository,
  SELECT_AUTOMATION_EVENT_BY_ID_SQL,
  SELECT_AUTOMATION_EVENT_BY_KEY_SQL,
  buildTargetDates,
  collectPaymentTargetIds,
  mapAutomationEventRow,
  mapInstallmentRow,
  mapPaymentRow,
};
