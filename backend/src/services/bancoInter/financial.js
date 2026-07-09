const { randomUUID } = require("node:crypto");

const { canManageSystem } = require("../../../auth.js");
const { query, tableExists, transaction } = require("../../config/db.js");
const { syncChargeCompatibility } = require("../../../services/student-finance.js");
const { FINANCIAL_STATUSES, normalizeFinancialStatus } = require("./types.js");
const {
  dateOnly,
  logInter,
  nowMysql,
  nullableText,
  parseJson,
  safeJsonStringify,
  text,
} = require("./utils.js");
const { emitFinancialPaymentUpdated } = require("./realtime.js");

function safeIdentifier(value) {
  const normalized = text(value, 80);
  if (!/^[a-zA-Z0-9_]+$/.test(normalized)) {
    throw new Error(`Identificador SQL invalido: ${value}`);
  }
  return normalized;
}

async function ensureColumn(tableName, columnName, definition) {
  const safeTable = safeIdentifier(tableName);
  const safeColumn = safeIdentifier(columnName);
  const rows = await query(`SHOW COLUMNS FROM \`${safeTable}\` LIKE ?`, [safeColumn]);
  if (Array.isArray(rows) && rows.length > 0) return;
  await query(`ALTER TABLE \`${safeTable}\` ADD COLUMN \`${safeColumn}\` ${definition}`);
}

async function ensureIndex(tableName, indexName, definition) {
  const safeTable = safeIdentifier(tableName);
  const rows = await query(`SHOW INDEX FROM \`${safeTable}\` WHERE Key_name = ?`, [indexName]);
  if (Array.isArray(rows) && rows.length > 0) return;
  await query(`ALTER TABLE \`${safeTable}\` ADD ${definition}`);
}

async function ensureInterFinancialSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS financial_payments (
      id VARCHAR(64) PRIMARY KEY,
      student_id VARCHAR(64) NULL,
      responsible_id VARCHAR(64) NULL,
      mensalidade_id VARCHAR(64) NULL,
      charge_id VARCHAR(64) NULL,
      txid VARCHAR(35) NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      status ENUM('PENDENTE', 'PROCESSANDO', 'PAGO', 'ATRASADO', 'VENCIDO', 'CANCELADO') NOT NULL DEFAULT 'PENDENTE',
      due_date DATE NULL,
      paid_at DATETIME NULL,
      payment_method VARCHAR(50) NULL,
      pix_payload LONGTEXT NULL,
      pix_copy_paste LONGTEXT NULL,
      qr_code LONGTEXT NULL,
      e2eid VARCHAR(191) NULL,
      inter_transaction_id VARCHAR(191) NULL,
      webhook_payload LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_financial_payments_txid (txid),
      INDEX idx_financial_payments_student (student_id),
      INDEX idx_financial_payments_responsible (responsible_id),
      INDEX idx_financial_payments_mensalidade (mensalidade_id),
      INDEX idx_financial_payments_charge (charge_id),
      INDEX idx_financial_payments_status (status)
    )
  `);

  await ensureColumn("financial_payments", "student_id", "VARCHAR(64) NULL");
  await ensureColumn("financial_payments", "responsible_id", "VARCHAR(64) NULL");
  await ensureColumn("financial_payments", "mensalidade_id", "VARCHAR(64) NULL");
  await ensureColumn("financial_payments", "charge_id", "VARCHAR(64) NULL");
  await ensureColumn("financial_payments", "txid", "VARCHAR(35) NULL");
  await ensureColumn("financial_payments", "amount", "DECIMAL(10,2) NOT NULL DEFAULT 0");
  await ensureColumn(
    "financial_payments",
    "status",
    "ENUM('PENDENTE', 'PROCESSANDO', 'PAGO', 'ATRASADO', 'VENCIDO', 'CANCELADO') NOT NULL DEFAULT 'PENDENTE'",
  );
  await ensureColumn("financial_payments", "due_date", "DATE NULL");
  await ensureColumn("financial_payments", "paid_at", "DATETIME NULL");
  await ensureColumn("financial_payments", "payment_method", "VARCHAR(50) NULL");
  await ensureColumn("financial_payments", "pix_payload", "LONGTEXT NULL");
  await ensureColumn("financial_payments", "pix_copy_paste", "LONGTEXT NULL");
  await ensureColumn("financial_payments", "qr_code", "LONGTEXT NULL");
  await ensureColumn("financial_payments", "e2eid", "VARCHAR(191) NULL");
  await ensureColumn("financial_payments", "inter_transaction_id", "VARCHAR(191) NULL");
  await ensureColumn("financial_payments", "webhook_payload", "LONGTEXT NULL");
  await ensureIndex(
    "financial_payments",
    "uniq_financial_payments_txid",
    "UNIQUE INDEX `uniq_financial_payments_txid` (`txid`)",
  );
  await ensureIndex(
    "financial_payments",
    "idx_financial_payments_student",
    "INDEX `idx_financial_payments_student` (`student_id`)",
  );
  await ensureIndex(
    "financial_payments",
    "idx_financial_payments_charge",
    "INDEX `idx_financial_payments_charge` (`charge_id`)",
  );

  await query(`
    CREATE TABLE IF NOT EXISTS inter_webhook_events (
      id VARCHAR(64) PRIMARY KEY,
      event_hash VARCHAR(64) NOT NULL,
      txid VARCHAR(35) NULL,
      e2eid VARCHAR(191) NULL,
      payload LONGTEXT NULL,
      processed TINYINT(1) NOT NULL DEFAULT 0,
      error TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_inter_webhook_events_hash (event_hash),
      INDEX idx_inter_webhook_events_txid (txid),
      INDEX idx_inter_webhook_events_e2eid (e2eid)
    )
  `);
}

function mapPaymentRow(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    studentId: row.student_id == null ? null : String(row.student_id),
    responsibleId: row.responsible_id == null ? null : String(row.responsible_id),
    mensalidadeId: row.mensalidade_id == null ? null : String(row.mensalidade_id),
    chargeId: row.charge_id == null ? null : String(row.charge_id),
    txid: String(row.txid),
    amount: Number(row.amount || 0),
    status: normalizeFinancialStatus(row.status),
    dueDate: row.due_date ?? null,
    paidAt: row.paid_at ?? null,
    paymentMethod: row.payment_method ?? null,
    pixPayload: parseJson(row.pix_payload, row.pix_payload ?? null),
    pixCopyPaste: row.pix_copy_paste ?? null,
    qrCode: row.qr_code ?? null,
    e2eid: row.e2eid ?? null,
    interTransactionId: row.inter_transaction_id ?? null,
    webhookPayload: parseJson(row.webhook_payload, null),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function mapChargeRow(row, source) {
  const finalAmount = Number(row.valor_final ?? row.valor ?? 0);
  const chargeId = text(
    row.cobranca_id ?? row.charge_id ?? (source === "charge" ? row.id : ""),
    64,
  );
  const mensalidadeId = text(
    source === "mensalidade" ? row.id : (row.mensalidade_id ?? row.id),
    64,
  );

  return {
    source,
    id: text(row.id, 64),
    chargeId: chargeId || (source === "charge" ? text(row.id, 64) : null),
    mensalidadeId: mensalidadeId || null,
    studentId: text(row.aluno_id ?? row.student_id, 64),
    responsibleId: nullableText(row.responsavel_id ?? row.responsible_id, 64),
    studentName: text(row.nome_aluno ?? row.aluno_nome ?? row.nome_completo, 191) || "Aluno J12",
    responsibleName: nullableText(row.responsavel_financeiro ?? row.responsavel_nome, 191),
    responsibleCpf: nullableText(row.responsavel_cpf ?? row.cpf_responsavel, 20),
    email: nullableText(row.email ?? row.email_contato, 191),
    phone: nullableText(row.telefone_whatsapp ?? row.telefone_contato, 50),
    description:
      text(row.descricao, 191) ||
      (text(row.referencia ?? row.competencia, 50)
        ? `Mensalidade ${text(row.referencia ?? row.competencia, 50)}`
        : "Mensalidade J12"),
    amount: Number.isFinite(finalAmount) ? Number(finalAmount.toFixed(2)) : 0,
    dueDate: dateOnly(row.vencimento ?? row.data_vencimento),
    status: text(row.status, 30).toLowerCase(),
  };
}

async function loadChargeById(id) {
  const normalizedId = text(id, 64);
  if (!normalizedId) return null;

  if (await tableExists("j12_financeiro_cobrancas")) {
    const rows = await query(
      `
        SELECT
          c.*,
          a.responsavel_id
        FROM j12_financeiro_cobrancas c
        LEFT JOIN j12_alunos a ON CAST(a.id AS CHAR) = CAST(c.aluno_id AS CHAR)
        WHERE c.id = ?
        LIMIT 1
      `,
      [normalizedId],
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return mapChargeRow(rows[0], "charge");
    }
  }

  if (await tableExists("j12_mensalidades")) {
    const rows = await query(
      `
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
      `,
      [normalizedId, normalizedId],
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return mapChargeRow(rows[0], "mensalidade");
    }
  }

  return null;
}

async function loadChargeForPix({ mensalidadeId, chargeId, id }) {
  const identifiers = [chargeId, mensalidadeId, id].map((value) => text(value, 64)).filter(Boolean);

  for (const identifier of identifiers) {
    const charge = await loadChargeById(identifier);
    if (charge) return charge;
  }

  const error = new Error("Cobranca financeira nao encontrada para gerar PIX.");
  error.statusCode = 404;
  throw error;
}

async function userCanAccessStudent(user, studentId) {
  const normalizedStudentId = text(studentId, 64);
  if (!user || !normalizedStudentId) return false;
  if (canManageSystem(user)) return true;

  const role = text(user.role || user.perfil, 50).toLowerCase();
  const userStudentId = text(user.studentId ?? user.alunoId ?? user.aluno_id, 64);
  if (role === "aluno" && userStudentId === normalizedStudentId) return true;
  if (role !== "responsavel") return false;
  if (userStudentId === normalizedStudentId) return true;

  const possibleResponsibleIds = [user.responsavelId, user.responsavel_id, user.id]
    .map((value) => text(value, 64))
    .filter(Boolean);

  if (possibleResponsibleIds.length === 0) return false;

  if (await tableExists("j12_responsavel_alunos")) {
    const placeholders = possibleResponsibleIds.map(() => "?").join(", ");
    const rows = await query(
      `
        SELECT 1 AS ok
        FROM j12_responsavel_alunos
        WHERE CAST(aluno_id AS CHAR) = ?
          AND CAST(responsavel_id AS CHAR) IN (${placeholders})
        LIMIT 1
      `,
      [normalizedStudentId, ...possibleResponsibleIds],
    );

    if (Array.isArray(rows) && rows.length > 0) return true;
  }

  if (await tableExists("j12_alunos")) {
    const placeholders = possibleResponsibleIds.map(() => "?").join(", ");
    const rows = await query(
      `
        SELECT 1 AS ok
        FROM j12_alunos
        WHERE CAST(id AS CHAR) = ?
          AND CAST(responsavel_id AS CHAR) IN (${placeholders})
        LIMIT 1
      `,
      [normalizedStudentId, ...possibleResponsibleIds],
    );

    if (Array.isArray(rows) && rows.length > 0) return true;
  }

  return false;
}

async function assertPaymentAccess(user, charge) {
  if (await userCanAccessStudent(user, charge.studentId)) return;

  const error = new Error("Sem permissao para acessar esta cobranca.");
  error.statusCode = 403;
  throw error;
}

async function findReusablePendingPayment(charge) {
  await ensureInterFinancialSchema();

  const conditions = [];
  const params = [];

  if (charge.chargeId) {
    conditions.push("charge_id = ?");
    params.push(charge.chargeId);
  }

  if (charge.mensalidadeId) {
    conditions.push("mensalidade_id = ?");
    params.push(charge.mensalidadeId);
  }

  if (conditions.length === 0) return null;

  const rows = await query(
    `
      SELECT *
      FROM financial_payments
      WHERE (${conditions.join(" OR ")})
        AND status IN ('PENDENTE', 'PROCESSANDO')
        AND pix_copy_paste IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `,
    params,
  );

  return mapPaymentRow(Array.isArray(rows) ? rows[0] : null);
}

async function findPaymentByTxid(txid) {
  await ensureInterFinancialSchema();
  const normalizedTxid = text(txid, 35);
  if (!normalizedTxid) return null;

  const rows = await query(
    `
      SELECT *
      FROM financial_payments
      WHERE txid = ?
      LIMIT 1
    `,
    [normalizedTxid],
  );

  return mapPaymentRow(Array.isArray(rows) ? rows[0] : null);
}

async function savePixPayment({ charge, txid, pixPayload, pixCopyPaste, qrCode }) {
  await ensureInterFinancialSchema();
  const paymentId = `fp-${randomUUID().replace(/-/g, "").slice(0, 24)}`;

  await query(
    `
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
        qr_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDENTE', ?, 'pix', ?, ?, ?)
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
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      paymentId,
      charge.studentId,
      charge.responsibleId,
      charge.mensalidadeId,
      charge.chargeId,
      txid,
      charge.amount,
      charge.dueDate,
      safeJsonStringify(pixPayload),
      pixCopyPaste,
      qrCode,
    ],
  );

  return findPaymentByTxid(txid);
}

async function recordWebhookEvent({
  eventHash,
  txid,
  e2eid,
  payload,
  processed = false,
  error = null,
}) {
  await ensureInterFinancialSchema();
  const id = `iwe-${randomUUID().replace(/-/g, "").slice(0, 24)}`;

  await query(
    `
      INSERT IGNORE INTO inter_webhook_events (
        id,
        event_hash,
        txid,
        e2eid,
        payload,
        processed,
        error
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      text(eventHash, 64),
      nullableText(txid, 35),
      nullableText(e2eid, 191),
      safeJsonStringify(payload),
      processed ? 1 : 0,
      nullableText(error, 65535),
    ],
  );

  const rows = await query("SELECT * FROM inter_webhook_events WHERE event_hash = ? LIMIT 1", [
    text(eventHash, 64),
  ]);

  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function markWebhookEventProcessed(eventHash, error = null) {
  await query(
    `
      UPDATE inter_webhook_events
      SET processed = ?, error = ?
      WHERE event_hash = ?
    `,
    [error ? 0 : 1, nullableText(error, 65535), text(eventHash, 64)],
  );
}

async function refreshStudentAccess(studentId) {
  const normalizedStudentId = text(studentId, 64);
  if (!normalizedStudentId) return { status: "ignorado", overdueCount: 0 };

  let overdueCount = 0;
  if (await tableExists("j12_financeiro_cobrancas")) {
    const rows = await query(
      `
        SELECT COUNT(*) AS total
        FROM j12_financeiro_cobrancas
        WHERE CAST(aluno_id AS CHAR) = ?
          AND status IN ('pendente', 'atrasado')
          AND vencimento < CURDATE()
      `,
      [normalizedStudentId],
    );
    overdueCount = Number(rows?.[0]?.total || 0);
  }

  const nextStatus = overdueCount > 0 ? "bloqueado" : "ativo";
  if (await tableExists("users")) {
    await query(
      `
        UPDATE users
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE (
          CAST(aluno_id AS CHAR) = ?
          OR CAST(linked_aluno_id AS CHAR) = ?
        )
          AND role IN ('aluno', 'responsavel')
          AND status IN ('ativo', 'bloqueado', 'inadimplente', 'suspenso')
      `,
      [nextStatus, normalizedStudentId, normalizedStudentId],
    );
  }

  return {
    status: nextStatus,
    overdueCount,
  };
}

async function markPaymentAsPaid({ payment, webhookPayload, e2eid, interTransactionId, paidAt }) {
  await ensureInterFinancialSchema();
  const paidDateTime = paidAt ? nowMysqlFromValue(paidAt) : nowMysql();
  const paidDate = paidDateTime.slice(0, 10);

  const updatedPayment = await transaction(async (connection) => {
    await connection.execute(
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
        paidDateTime,
        nullableText(e2eid, 191),
        nullableText(interTransactionId, 191),
        safeJsonStringify(webhookPayload),
        payment.txid,
      ],
    );

    if (payment.chargeId) {
      await connection.execute(
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
        [paidDate, paidDate, payment.chargeId],
      );
    }

    if (payment.mensalidadeId || payment.chargeId) {
      await connection.execute(
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
        [paidDate, payment.mensalidadeId || "", payment.chargeId || ""],
      );
    }

    if (payment.mensalidadeId || payment.chargeId) {
      await connection.execute(
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
          text(`pag-${payment.chargeId || payment.mensalidadeId}`, 64),
          text(payment.mensalidadeId || payment.chargeId, 64),
          text(payment.chargeId || payment.mensalidadeId, 64),
          text(payment.studentId, 64),
          payment.amount,
          paidDate,
          text(`Baixa automatica Banco Inter${e2eid ? ` - E2E ${e2eid}` : ""}`, 65535),
        ],
      );
    }

    const [rows] = await connection.execute(
      "SELECT * FROM financial_payments WHERE txid = ? LIMIT 1",
      [payment.txid],
    );

    return mapPaymentRow(Array.isArray(rows) ? rows[0] : null);
  });

  if (payment.chargeId) {
    try {
      await syncChargeCompatibility(payment.chargeId);
    } catch (error) {
      logInter("baixa", "Falha ao sincronizar tabelas de compatibilidade apos baixa.", {
        chargeId: payment.chargeId,
        error: error.message,
      });
    }
  }

  const access = await refreshStudentAccess(payment.studentId);

  emitFinancialPaymentUpdated({
    txid: updatedPayment?.txid || payment.txid,
    paymentId: updatedPayment?.id || payment.id,
    studentId: payment.studentId,
    chargeId: payment.chargeId,
    mensalidadeId: payment.mensalidadeId,
    status: FINANCIAL_STATUSES.PAID,
    paidAt: paidDateTime,
    access,
  });

  return {
    payment: updatedPayment,
    access,
  };
}

function nowMysqlFromValue(value) {
  if (!value) return nowMysql();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return nowMysql();
  return date.toISOString().slice(0, 19).replace("T", " ");
}

module.exports = {
  assertPaymentAccess,
  ensureInterFinancialSchema,
  findPaymentByTxid,
  findReusablePendingPayment,
  loadChargeForPix,
  markPaymentAsPaid,
  markWebhookEventProcessed,
  recordWebhookEvent,
  refreshStudentAccess,
  savePixPayment,
  userCanAccessStudent,
};
