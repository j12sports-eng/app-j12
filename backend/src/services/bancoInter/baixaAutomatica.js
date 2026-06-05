const crypto = require("node:crypto");

const {
  findPaymentByTxid,
  markPaymentAsPaid,
  markWebhookEventProcessed,
  recordWebhookEvent,
} = require("./financial.js");
const { FINANCIAL_STATUSES } = require("./types.js");
const { logInter, safeJsonStringify, text } = require("./utils.js");

function extractPixEvents(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.pix)) return payload.pix;
  if (Array.isArray(payload.eventos)) return payload.eventos;
  if (payload.txid || payload.endToEndId || payload.e2eid || payload.e2eId) return [payload];
  return [];
}

function normalizePixEvent(event) {
  const txid = text(event.txid ?? event.txId ?? event.cob?.txid, 35);
  const e2eid = text(event.endToEndId ?? event.e2eid ?? event.e2eId ?? event.end_to_end_id, 191);
  const paidAt = event.horario ?? event.criadoEm ?? event.createdAt ?? event.dataPagamento ?? null;

  return {
    txid,
    e2eid,
    paidAt,
    value: event.valor ?? event.amount ?? null,
    interTransactionId: text(event.id ?? event.transactionId ?? event.codigoSolicitacao, 191),
    raw: event,
  };
}

function buildEventHash(event) {
  const payload = safeJsonStringify({
    txid: event.txid,
    e2eid: event.e2eid,
    paidAt: event.paidAt,
    value: event.value,
  });

  return crypto.createHash("sha256").update(payload).digest("hex");
}

async function processPixConfirmation(event, webhookPayload) {
  const normalized = normalizePixEvent(event);
  const eventHash = buildEventHash(normalized);

  await recordWebhookEvent({
    eventHash,
    txid: normalized.txid,
    e2eid: normalized.e2eid,
    payload: webhookPayload,
  });

  if (!normalized.txid) {
    const message = "Webhook Banco Inter sem txid.";
    await markWebhookEventProcessed(eventHash, message);
    logInter("webhook", message, { e2eid: normalized.e2eid });
    return {
      processed: false,
      duplicate: false,
      error: message,
      txid: null,
    };
  }

  const payment = await findPaymentByTxid(normalized.txid);
  if (!payment) {
    const message = "Pagamento local nao encontrado para txid recebido no webhook.";
    await markWebhookEventProcessed(eventHash, message);
    logInter("webhook", message, {
      txid: normalized.txid,
      e2eid: normalized.e2eid,
    });
    return {
      processed: false,
      duplicate: false,
      error: message,
      txid: normalized.txid,
    };
  }

  if (payment.status === FINANCIAL_STATUSES.PAID) {
    await markWebhookEventProcessed(eventHash);
    logInter("webhook", "Webhook duplicado ignorado: pagamento ja estava pago.", {
      txid: normalized.txid,
      e2eid: normalized.e2eid,
    });
    return {
      processed: true,
      duplicate: true,
      txid: normalized.txid,
      payment,
    };
  }

  const result = await markPaymentAsPaid({
    payment,
    webhookPayload,
    e2eid: normalized.e2eid,
    interTransactionId: normalized.interTransactionId,
    paidAt: normalized.paidAt,
  });

  await markWebhookEventProcessed(eventHash);
  logInter("baixa", "Baixa automatica concluida.", {
    txid: normalized.txid,
    paymentId: payment.id,
    studentId: payment.studentId,
  });

  return {
    processed: true,
    duplicate: false,
    txid: normalized.txid,
    payment: result.payment,
    access: result.access,
  };
}

async function processInterWebhookPayload(payload) {
  const events = extractPixEvents(payload);
  if (events.length === 0) {
    logInter("webhook", "Webhook Banco Inter recebido sem eventos PIX processaveis.");
    return {
      processed: 0,
      duplicates: 0,
      errors: 0,
      results: [],
    };
  }

  const results = [];

  for (const event of events) {
    try {
      results.push(await processPixConfirmation(event, payload));
    } catch (error) {
      logInter("webhook", "Erro ao processar evento PIX do webhook.", {
        error: error.message,
        event,
      });
      results.push({
        processed: false,
        duplicate: false,
        error: error.message,
        txid: text(event?.txid, 35) || null,
      });
    }
  }

  return {
    processed: results.filter((item) => item.processed && !item.duplicate).length,
    duplicates: results.filter((item) => item.duplicate).length,
    errors: results.filter((item) => item.error).length,
    results,
  };
}

module.exports = {
  extractPixEvents,
  processInterWebhookPayload,
  processPixConfirmation,
};
