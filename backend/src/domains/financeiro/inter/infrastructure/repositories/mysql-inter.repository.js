const { randomUUID } = require("node:crypto");

const {
  InterPaymentEntity,
  InterPaymentStatus,
} = require("../../entities/inter-payment.entity.js");

const SELECT_CHARGE_BY_ID_SQL = `
  SELECT
    c.*,
    a.responsavel_id
  FROM j12_financeiro_cobrancas c
  LEFT JOIN j12_alunos a ON CAST(a.id AS CHAR) = CAST(c.aluno_id AS CHAR)
  WHERE c.id = ?
  LIMIT 1
`;

const SELECT_INSTALLMENT_BY_ID_SQL = `
  SELECT
    m.*,
    a.nome_completo,
    a.responsavel_id,
    r.nome AS responsavel_nome,
    r.cpf AS responsavel_cpf,
    r.telefone AS telefone_whatsapp,
    r.email
  FROM j12_mensalidades m
  LEFT JOIN j12_alunos a ON CAST(a.id AS CHAR) = CAST(m.aluno_id AS CHAR)
  LEFT JOIN j12_responsaveis r ON CAST(r.id AS CHAR) = CAST(a.responsavel_id AS CHAR)
  WHERE m.id = ? OR m.cobranca_id = ?
  LIMIT 1
`;

const SELECT_PAYMENT_BY_ANY_ID_SQL = `
  SELECT *
  FROM financial_payments
  WHERE id = ?
     OR txid = ?
     OR charge_id = ?
     OR mensalidade_id = ?
  LIMIT 1
`;

const SELECT_PAYMENT_BY_TXID_SQL = `
  SELECT *
  FROM financial_payments
  WHERE txid = ?
  LIMIT 1
`;

const SELECT_OPEN_PAYMENTS_SQL = `
  SELECT *
  FROM financial_payments
  WHERE status IN ('PENDENTE', 'PROCESSANDO', 'VENCIDO', 'ATRASADO')
  ORDER BY created_at ASC
  LIMIT ?
`;

const INSERT_INTER_PAYMENT_SQL = `
  INSERT INTO financial_payments (
    id,
    student_id,
    responsible_id,
    mensalidade_id,
    charge_id,
    txid,
    amount,
    status,
    due_date,
    payment_method,
    pix_payload,
    pix_copy_paste,
    qr_code,
    inter_transaction_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDENTE', ?, 'pix', ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    student_id = VALUES(student_id),
    responsible_id = VALUES(responsible_id),
    mensalidade_id = VALUES(mensalidade_id),
    charge_id = VALUES(charge_id),
    amount = VALUES(amount),
    status = IF(status = 'PAGO', status, VALUES(status)),
    due_date = VALUES(due_date),
    payment_method = VALUES(payment_method),
    pix_payload = VALUES(pix_payload),
    pix_copy_paste = VALUES(pix_copy_paste),
    qr_code = VALUES(qr_code),
    inter_transaction_id = COALESCE(VALUES(inter_transaction_id), inter_transaction_id),
    updated_at = CURRENT_TIMESTAMP
`;

const INSERT_WEBHOOK_EVENT_SQL = `
  INSERT IGNORE INTO inter_webhook_events (
    id,
    event_hash,
    txid,
    e2eid,
    payload,
    processed,
    error
  ) VALUES (?, ?, ?, ?, ?, 0, NULL)
`;

const SELECT_WEBHOOK_EVENT_SQL = `
  SELECT *
  FROM inter_webhook_events
  WHERE event_hash = ?
  LIMIT 1
`;

const UPDATE_WEBHOOK_EVENT_SQL = `
  UPDATE inter_webhook_events
  SET processed = ?, error = ?
  WHERE event_hash = ?
`;

class MySqlInterRepository {
  constructor(options = {}) {
    this.query = options.queryRunner || getDefaultQueryRunner();
    this.transactionRunner = options.transactionRunner || getDefaultTransactionRunner();
    this.idGenerator = options.idGenerator || defaultIdGenerator;
  }

  async findChargeForInter(input = {}) {
    const identifiers = [
      nullableText(input.chargeId ?? input.cobrancaId, 64),
      nullableText(input.mensalidadeId, 64),
      nullableText(input.id, 64),
    ].filter(Boolean);

    for (const identifier of identifiers) {
      const chargeRows = await this.query(SELECT_CHARGE_BY_ID_SQL, [identifier]);
      const charge = mapChargeRow(readFirstRow(chargeRows), "charge");

      if (charge) {
        return charge;
      }

      const installmentRows = await this.query(SELECT_INSTALLMENT_BY_ID_SQL, [
        identifier,
        identifier,
      ]);
      const installment = mapChargeRow(readFirstRow(installmentRows), "mensalidade");

      if (installment) {
        return installment;
      }
    }

    return null;
  }

  async saveIssuedCharge(input = {}) {
    const charge = input.charge || {};
    const paymentId = nullableText(input.paymentId, 64) || this.idGenerator("fpi");
    const pixPayload = {
      charge: input.interCharge || null,
      paymentLink: input.paymentLink || null,
      qrcode: input.qrCodePayload || null,
      request: input.requestPayload || null,
      response: input.responsePayload || null,
    };

    await this.query(INSERT_INTER_PAYMENT_SQL, [
      paymentId,
      nullableText(charge.studentId, 64),
      nullableText(charge.responsibleId, 64),
      nullableText(charge.mensalidadeId, 64),
      nullableText(charge.chargeId, 64),
      requiredText(input.txid, "txid", 35),
      normalizeAmount(charge.amount),
      nullableText(charge.dueDate, 10),
      safeJsonStringify(pixPayload),
      nullableText(input.pixCopyPaste, 4096),
      nullableText(input.qrCode, 5 * 1024 * 1024),
      nullableText(input.interTransactionId, 191),
    ]);

    return this.findPaymentByTxid(input.txid);
  }

  async findPayment(input = {}) {
    const id = requiredText(
      input.id ?? input.txid ?? input.chargeId ?? input.mensalidadeId,
      "id",
      64,
    );
    const rows = await this.query(SELECT_PAYMENT_BY_ANY_ID_SQL, [id, id, id, id]);

    return mapPaymentRow(readFirstRow(rows));
  }

  async findPaymentByTxid(txid) {
    const rows = await this.query(SELECT_PAYMENT_BY_TXID_SQL, [requiredText(txid, "txid", 35)]);

    return mapPaymentRow(readFirstRow(rows));
  }

  async listOpenPayments(input = {}) {
    const rows = await this.query(SELECT_OPEN_PAYMENTS_SQL, [normalizeLimit(input.limit, 50)]);

    return readRows(rows).map(mapPaymentRow).filter(Boolean);
  }

  async recordWebhookEvent(input = {}) {
    const eventHash = requiredText(input.eventHash, "eventHash", 64);

    await this.query(INSERT_WEBHOOK_EVENT_SQL, [
      nullableText(input.id, 64) || this.idGenerator("iwe"),
      eventHash,
      nullableText(input.txid, 35),
      nullableText(input.e2eid, 191),
      safeJsonStringify(input.payload || null),
    ]);

    return this.findWebhookEvent(eventHash);
  }

  async findWebhookEvent(eventHash) {
    const rows = await this.query(SELECT_WEBHOOK_EVENT_SQL, [
      requiredText(eventHash, "eventHash", 64),
    ]);

    return readFirstRow(rows);
  }

  async markWebhookEventProcessed(input = {}) {
    await this.query(UPDATE_WEBHOOK_EVENT_SQL, [
      input.error ? 0 : 1,
      nullableText(input.error, 65535),
      requiredText(input.eventHash, "eventHash", 64),
    ]);
  }

  async reconcilePayment(input = {}) {
    const payment = new InterPaymentEntity(input.payment || {});
    const targetStatus = input.status || InterPaymentStatus.PAID;
    const paidAt = normalizeDateTime(input.paidAt) || nowMysql();
    const paidDate = paidAt.slice(0, 10);

    await this.transactionRunner(async (connection) => {
      const query = createConnectionQuery(connection);

      if (targetStatus === InterPaymentStatus.PAID) {
        await markPaymentAsPaid(query, payment, {
          e2eid: input.e2eid,
          interTransactionId: input.interTransactionId,
          paidAt,
          paidDate,
          webhookPayload: input.webhookPayload,
        });
        return;
      }

      await markPaymentAsNotPaid(query, payment, {
        reason: input.reason,
        status: targetStatus,
        webhookPayload: input.webhookPayload,
      });
    });

    return this.findPaymentByTxid(payment.txid);
  }
}

async function markPaymentAsPaid(query, payment, input) {
  await query(
    `
      UPDATE financial_payments
      SET
        status = 'PAGO',
        paid_at = ?,
        payment_method = 'pix',
        e2eid = COALESCE(?, e2eid),
        inter_transaction_id = COALESCE(?, inter_transaction_id),
        webhook_payload = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE txid = ?
    `,
    [
      input.paidAt,
      nullableText(input.e2eid, 191),
      nullableText(input.interTransactionId, 191),
      safeJsonStringify(input.webhookPayload || null),
      payment.txid,
    ],
  );

  if (payment.chargeId) {
    await query(
      `
        UPDATE j12_financeiro_cobrancas
        SET
          status = 'pago',
          pago_em = ?,
          data_pagamento = ?,
          forma_pagamento = 'pix',
          observacao = COALESCE(NULLIF(observacao, ''), 'Baixa automatica Banco Inter'),
          alterado_em = NOW(),
          alterado_por = 'Banco Inter'
        WHERE id = ?
      `,
      [input.paidDate, input.paidDate, payment.chargeId],
    );
  }

  if (payment.mensalidadeId || payment.chargeId) {
    await query(
      `
        UPDATE j12_mensalidades
        SET
          status = 'pago',
          data_pagamento = ?,
          forma_pagamento = 'pix',
          observacao = COALESCE(NULLIF(observacao, ''), 'Baixa automatica Banco Inter'),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? OR cobranca_id = ?
      `,
      [input.paidDate, payment.mensalidadeId || "", payment.chargeId || ""],
    );

    await query(
      `
        INSERT INTO j12_pagamentos (
          id,
          mensalidade_id,
          cobranca_id,
          aluno_id,
          valor,
          forma_pagamento,
          data_pagamento,
          observacao
        ) VALUES (?, ?, ?, ?, ?, 'pix', ?, ?)
        ON DUPLICATE KEY UPDATE
          aluno_id = VALUES(aluno_id),
          valor = VALUES(valor),
          forma_pagamento = VALUES(forma_pagamento),
          data_pagamento = VALUES(data_pagamento),
          observacao = VALUES(observacao),
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        nullableText(`inter-${payment.txid}`, 64),
        nullableText(payment.mensalidadeId || payment.chargeId, 64),
        nullableText(payment.chargeId || payment.mensalidadeId, 64),
        nullableText(payment.studentId, 64),
        payment.amount || 0,
        input.paidDate,
        nullableText(
          `Baixa automatica Banco Inter${input.e2eid ? ` - E2E ${input.e2eid}` : ""}`,
          65535,
        ),
      ],
    );
  }
}

async function markPaymentAsNotPaid(query, payment, input) {
  const legacyStatus = mapLegacyStatus(input.status, payment.dueDate);
  const reason = nullableText(input.reason, 191) || "Atualizacao automatica Banco Inter";

  await query(
    `
      UPDATE financial_payments
      SET
        status = ?,
        webhook_payload = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE txid = ?
    `,
    [
      mapFinancialPaymentStatus(input.status),
      safeJsonStringify(input.webhookPayload || null),
      payment.txid,
    ],
  );

  if (payment.chargeId) {
    await query(
      `
        UPDATE j12_financeiro_cobrancas
        SET
          status = ?,
          cancelamento_motivo = CASE WHEN ? = 'cancelado' THEN ? ELSE cancelamento_motivo END,
          alterado_em = NOW(),
          alterado_por = 'Banco Inter'
        WHERE id = ?
      `,
      [legacyStatus, legacyStatus, reason, payment.chargeId],
    );
  }

  if (payment.mensalidadeId || payment.chargeId) {
    await query(
      `
        UPDATE j12_mensalidades
        SET
          status = ?,
          observacao = COALESCE(NULLIF(observacao, ''), ?),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? OR cobranca_id = ?
      `,
      [legacyStatus, reason, payment.mensalidadeId || "", payment.chargeId || ""],
    );
  }
}

function mapChargeRow(row, source) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const amount = Number(row.valor_final ?? row.valor ?? row.valor_atualizado ?? 0);
  const chargeId =
    nullableText(row.cobranca_id ?? row.charge_id, 64) ||
    (source === "charge" ? nullableText(row.id, 64) : null);
  const mensalidadeId =
    source === "mensalidade" ? nullableText(row.id, 64) : nullableText(row.mensalidade_id, 64);

  return {
    amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0,
    chargeId,
    description:
      nullableText(row.descricao, 191) ||
      (nullableText(row.referencia ?? row.competencia, 50)
        ? `Mensalidade ${nullableText(row.referencia ?? row.competencia, 50)}`
        : "Mensalidade J12"),
    dueDate: dateOnly(row.vencimento ?? row.data_vencimento),
    email: nullableText(row.email ?? row.email_contato, 191),
    id: nullableText(row.id, 64),
    mensalidadeId,
    phone: nullableText(row.telefone_whatsapp ?? row.telefone_contato, 50),
    responsibleCpf: nullableText(row.responsavel_cpf ?? row.cpf_responsavel, 20),
    responsibleId: nullableText(row.responsavel_id ?? row.responsible_id, 64),
    responsibleName: nullableText(row.responsavel_financeiro ?? row.responsavel_nome, 191),
    source,
    status: nullableText(row.status, 30),
    studentId: nullableText(row.aluno_id ?? row.student_id, 64),
    studentName:
      nullableText(row.nome_aluno ?? row.aluno_nome ?? row.nome_completo, 191) || "Aluno J12",
  };
}

function mapPaymentRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  return new InterPaymentEntity({
    amount: row.amount,
    chargeId: row.charge_id,
    createdAt: row.created_at,
    dueDate: row.due_date,
    e2eid: row.e2eid,
    id: row.id,
    interTransactionId: row.inter_transaction_id,
    mensalidadeId: row.mensalidade_id,
    paidAt: row.paid_at,
    paymentMethod: row.payment_method,
    pixCopyPaste: row.pix_copy_paste,
    pixPayload: parseJson(row.pix_payload, null),
    qrCode: row.qr_code,
    responsibleId: row.responsible_id,
    status: row.status,
    studentId: row.student_id,
    txid: row.txid,
    updatedAt: row.updated_at,
    webhookPayload: parseJson(row.webhook_payload, null),
  }).toJSON();
}

function mapFinancialPaymentStatus(status) {
  if (status === InterPaymentStatus.EXPIRED) return "VENCIDO";
  if (status === InterPaymentStatus.CANCELLED || status === InterPaymentStatus.REFUNDED) {
    return "CANCELADO";
  }
  if (status === InterPaymentStatus.PROCESSING) return "PROCESSANDO";
  if (status === InterPaymentStatus.PAID) return "PAGO";
  return "PENDENTE";
}

function mapLegacyStatus(status, dueDate) {
  if (status === InterPaymentStatus.CANCELLED) return "cancelado";
  if (status === InterPaymentStatus.EXPIRED) return "atrasado";
  if (status === InterPaymentStatus.REFUNDED) {
    return isPastDate(dueDate) ? "atrasado" : "pendente";
  }
  return "pendente";
}

function isPastDate(value) {
  const normalized = dateOnly(value);
  return Boolean(normalized && normalized < new Date().toISOString().slice(0, 10));
}

function createConnectionQuery(connection) {
  if (typeof connection === "function") {
    return connection;
  }

  if (typeof connection?.execute === "function") {
    return async (sql, params = []) => {
      const result = await connection.execute(sql, params);
      return readRows(result);
    };
  }

  if (typeof connection?.query === "function") {
    return async (sql, params = []) => {
      const result = await connection.query(sql, params);
      return readRows(result);
    };
  }

  throw new TypeError("MySqlInterRepository requires a transaction connection.");
}

function readFirstRow(result) {
  const rows = readRows(result);
  return rows[0] && typeof rows[0] === "object" ? rows[0] : null;
}

function readRows(result) {
  if (!Array.isArray(result)) {
    return [];
  }

  if (Array.isArray(result[0])) {
    return result[0];
  }

  return result;
}

function normalizeLimit(value, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(50, max);
  }

  return Math.min(Math.trunc(parsed), max);
}

function normalizeAmount(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function normalizeDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

function dateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const normalized = nullableText(value, 32);
  return normalized ? normalized.slice(0, 10) : null;
}

function nowMysql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function parseJson(value, fallback = null) {
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
    throw new TypeError(`MySqlInterRepository requires ${field}.`);
  }

  return normalized;
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

function defaultIdGenerator(prefix) {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function getDefaultQueryRunner() {
  return require("../../../../../config/db.js").query;
}

function getDefaultTransactionRunner() {
  return require("../../../../../config/db.js").transaction;
}

module.exports = {
  INSERT_INTER_PAYMENT_SQL,
  INSERT_WEBHOOK_EVENT_SQL,
  MySqlInterRepository,
  SELECT_CHARGE_BY_ID_SQL,
  SELECT_INSTALLMENT_BY_ID_SQL,
  SELECT_OPEN_PAYMENTS_SQL,
  SELECT_PAYMENT_BY_ANY_ID_SQL,
  SELECT_PAYMENT_BY_TXID_SQL,
  SELECT_WEBHOOK_EVENT_SQL,
  UPDATE_WEBHOOK_EVENT_SQL,
  mapChargeRow,
  mapPaymentRow,
};
