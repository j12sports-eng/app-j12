const crypto = require("node:crypto");

const {
  InterPaymentStatus,
  normalizeInterPaymentStatus,
} = require("../../../../inter/entities/inter-payment.entity.js");
const { toInterWebhookDto } = require("../dtos/inter-provider.dto.js");
const {
  INTER_PROVIDER_WEBHOOK_SIGNATURE_INVALID_CODE,
  controlledError,
  validateWebhookInput,
} = require("../validators/inter-provider.validators.js");

class WebhookService {
  constructor(options = {}) {
    this.repository = options.repository;
    this.webhookSecret = nullableText(
      options.webhookSecret ?? process.env.INTER_WEBHOOK_SECRET,
      500,
    );
  }

  async processWebhook(input = {}) {
    const values = validateWebhookInput(input);
    const validationMode = this.validateSignature(values.headers);
    const events = extractWebhookEvents(values.body);
    const results = [];
    let processed = 0;
    let duplicates = 0;
    let errors = 0;

    for (const event of events) {
      try {
        const normalized = normalizeWebhookEvent(event);
        const eventHash = buildWebhookEventHash(normalized, values.body);
        const webhookEvent = await this.getRepository().recordWebhookEvent({
          e2eid: normalized.e2eid,
          eventHash,
          payload: values.body,
          txid: normalized.txid,
        });
        const duplicate = Number(webhookEvent?.processed || 0) === 1;

        if (duplicate) {
          duplicates += 1;
          results.push({
            duplicate: true,
            processed: true,
            txid: normalized.txid,
          });
          continue;
        }

        const payment = normalized.txid
          ? await this.getRepository().findPaymentByTxid(normalized.txid)
          : null;

        if (!payment) {
          const message = "Pagamento local nao encontrado para evento Banco Inter.";
          await this.getRepository().markWebhookEventProcessed({
            error: message,
            eventHash,
          });
          errors += 1;
          results.push({
            error: message,
            processed: false,
            txid: normalized.txid || null,
          });
          continue;
        }

        assertPaidAmountMatches(payment, normalized.amount, normalized.status);

        const updatedPayment = await this.getRepository().reconcilePayment({
          e2eid: normalized.e2eid,
          interTransactionId: normalized.interTransactionId,
          paidAt: normalized.paidAt,
          payment,
          reason: normalized.reason,
          status: normalized.status,
          webhookPayload: values.body,
        });

        await this.getRepository().markWebhookEventProcessed({ eventHash });
        processed += 1;
        results.push({
          payment: updatedPayment,
          processed: true,
          status: normalized.status,
          txid: normalized.txid,
        });
      } catch (error) {
        errors += 1;
        results.push({
          error: error instanceof Error ? error.message : String(error),
          processed: false,
        });
      }
    }

    return toInterWebhookDto({
      duplicates,
      errors,
      processed,
      results,
      validationMode,
    });
  }

  validateSignature(headers = {}) {
    if (!this.webhookSecret) {
      return "mtls";
    }

    const received =
      nullableText(headers["x-inter-signature"], 500) ||
      nullableText(headers["x-webhook-token"], 500) ||
      nullableText(headers["x-inter-token"], 500) ||
      nullableText(headers.authorization, 500)?.replace(/^Bearer\s+/i, "");

    if (!received || !safeEqual(received, this.webhookSecret)) {
      throw controlledError(
        "Webhook Banco Inter rejeitado: assinatura/token invalido.",
        INTER_PROVIDER_WEBHOOK_SIGNATURE_INVALID_CODE,
      );
    }

    return "shared-secret";
  }

  getRepository() {
    if (!this.repository || typeof this.repository.reconcilePayment !== "function") {
      throw new TypeError("WebhookService requires Banco Inter repository.");
    }

    return this.repository;
  }
}

function extractWebhookEvents(payload) {
  if (Array.isArray(payload?.pix)) return payload.pix;
  if (Array.isArray(payload?.eventos)) return payload.eventos;
  if (Array.isArray(payload?.events)) return payload.events;
  if (payload?.txid || payload?.cob?.txid || payload?.status) return [payload];
  return [];
}

function normalizeWebhookEvent(event = {}) {
  const status = normalizeWebhookStatus(event);
  const txid = nullableText(event.txid ?? event.txId ?? event.cob?.txid, 35);

  return {
    amount: event.valor ?? event.amount ?? event.valorPago ?? null,
    e2eid: nullableText(event.endToEndId ?? event.e2eid ?? event.e2eId ?? event.end_to_end_id, 191),
    interTransactionId: nullableText(
      event.id ?? event.transactionId ?? event.codigoSolicitacao,
      191,
    ),
    paidAt: event.horario ?? event.criadoEm ?? event.createdAt ?? event.dataPagamento ?? null,
    raw: event,
    reason: nullableText(event.motivo ?? event.reason ?? event.status, 191),
    status,
    txid,
  };
}

function assertPaidAmountMatches(payment, receivedAmount, status) {
  if (status !== InterPaymentStatus.PAID || receivedAmount == null || receivedAmount === "") return;

  const expectedCents = moneyToCents(payment?.amount);
  const receivedCents = moneyToCents(receivedAmount);
  if (expectedCents === null || receivedCents === null || expectedCents !== receivedCents) {
    throw controlledError(
      "Valor recebido no Pix diverge do valor integral da cobranca; baixa automatica bloqueada.",
      "INTER_PROVIDER_PAYMENT_AMOUNT_MISMATCH",
    );
  }
}

function moneyToCents(value) {
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function normalizeWebhookStatus(event = {}) {
  if (Array.isArray(event.devolucoes) && event.devolucoes.length > 0) {
    return InterPaymentStatus.REFUNDED;
  }

  const rawStatus = event.status ?? event.tipo ?? event.eventType ?? event.type;
  const normalized = String(rawStatus || "")
    .trim()
    .toUpperCase();

  if (!normalized && (event.endToEndId || event.e2eid || event.valor)) {
    return InterPaymentStatus.PAID;
  }

  if (normalized.includes("CONCLUID")) return InterPaymentStatus.PAID;
  if (normalized.includes("REMOVIDA") || normalized.includes("CANCEL")) {
    return InterPaymentStatus.CANCELLED;
  }
  if (normalized.includes("EXPIR")) return InterPaymentStatus.EXPIRED;

  return normalizeInterPaymentStatus(normalized);
}

function buildWebhookEventHash(event, payload) {
  return crypto.createHash("sha256").update(JSON.stringify({ event, payload })).digest("hex");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));

  return (
    leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

module.exports = {
  WebhookService,
  assertPaidAmountMatches,
  buildWebhookEventHash,
  extractWebhookEvents,
  normalizeWebhookEvent,
  normalizeWebhookStatus,
};
