const crypto = require("node:crypto");

const {
  InterPaymentStatus,
  normalizeInterPaymentStatus,
} = require("../../entities/inter-payment.entity.js");
const {
  toInterChargeDto,
  toInterPaymentDto,
  toInterSyncDto,
  toWebhookDto,
} = require("../dtos/inter.dto.js");
const {
  controlledError,
  nullableText,
  validateChargeLookupInput,
  validateCreateInterChargeInput,
  validateSyncInput,
  validateWebhookInput,
} = require("../validators/inter.validators.js");
const { BancoInterClient } = require("../../infrastructure/clients/banco-inter.client.js");
const {
  MySqlInterRepository,
} = require("../../infrastructure/repositories/mysql-inter.repository.js");

const INTER_CHARGE_NOT_FOUND_CODE = "INTER_CHARGE_NOT_FOUND";
const INTER_PAYMENT_NOT_FOUND_CODE = "INTER_PAYMENT_NOT_FOUND";
const INTER_WEBHOOK_SIGNATURE_INVALID_CODE = "INTER_WEBHOOK_SIGNATURE_INVALID";

class InterApplicationService {
  constructor(options = {}) {
    this.client = options.client || new BancoInterClient(options.clientOptions || {});
    this.logger = options.logger || console;
    this.now = typeof options.now === "function" ? options.now : () => new Date();
    this.repository =
      options.repository || new MySqlInterRepository(options.repositoryOptions || {});
    this.webhookSecret = nullableText(
      options.webhookSecret ?? process.env.INTER_WEBHOOK_SECRET,
      500,
    );
  }

  async emitirCobranca(input = {}) {
    const values = validateCreateInterChargeInput(input);
    const charge = await this.repository.findChargeForInter(values);

    if (!charge) {
      throw controlledError(
        "Cobranca financeira nao encontrada para emissao Banco Inter.",
        INTER_CHARGE_NOT_FOUND_CODE,
        values,
      );
    }

    const issued = await this.client.createPixCharge({
      amount: values.amount || charge.amount,
      chargeId: charge.chargeId,
      description: values.description || charge.description,
      expiresIn: values.expiresIn,
      mensalidadeId: charge.mensalidadeId,
      pixKey: values.pixKey,
      responsibleCpf: charge.responsibleCpf,
      responsibleName: charge.responsibleName,
      studentName: charge.studentName,
      txid: values.txid,
    });
    const payment = await this.repository.saveIssuedCharge({
      charge,
      interCharge: issued.interCharge,
      paymentLink: issued.paymentLink,
      pixCopyPaste: issued.pixCopyPaste,
      qrCode: issued.qrCode,
      requestPayload: issued.requestPayload,
      responsePayload: issued.responsePayload,
      txid: issued.txid,
    });

    return toInterChargeDto({
      interCharge: issued.interCharge,
      payment,
      paymentLink: issued.paymentLink,
      txid: issued.txid,
    });
  }

  async consultarCobranca(input = {}) {
    const values = validateChargeLookupInput(input);
    const payment = await this.repository.findPayment(values);

    if (!payment) {
      throw controlledError(
        "Pagamento Banco Inter nao encontrado no financeiro.",
        INTER_PAYMENT_NOT_FOUND_CODE,
        values,
      );
    }

    const interCharge = await this.client.getPixCharge(payment.txid);
    const reconciliation = await this.reconcileFromInterCharge(payment, interCharge);

    return toInterChargeDto({
      interCharge,
      payment: reconciliation.payment || payment,
      paymentLink: extractPaymentLink(interCharge),
    });
  }

  async cancelarCobranca(input = {}) {
    const values = validateChargeLookupInput(input);
    const payment = await this.repository.findPayment(values);

    if (!payment) {
      throw controlledError(
        "Pagamento Banco Inter nao encontrado para cancelamento.",
        INTER_PAYMENT_NOT_FOUND_CODE,
        values,
      );
    }

    const interCharge = await this.client.cancelPixCharge(
      payment.txid,
      input.reason || input.motivo,
    );
    const updatedPayment = await this.repository.reconcilePayment({
      payment,
      reason: input.reason || input.motivo || "Cancelamento solicitado no financeiro J12",
      status: InterPaymentStatus.CANCELLED,
      webhookPayload: interCharge,
    });

    return toInterChargeDto({
      interCharge,
      payment: updatedPayment,
      paymentLink: extractPaymentLink(interCharge),
    });
  }

  async sincronizar(input = {}) {
    const values = validateSyncInput(input);
    const payments = values.id
      ? [await this.repository.findPayment(values)].filter(Boolean)
      : await this.repository.listOpenPayments({ limit: values.limit });
    const results = [];
    let paid = 0;
    let synced = 0;
    let errors = 0;

    for (const payment of payments) {
      try {
        const interCharge = await this.client.getPixCharge(payment.txid);
        const result = await this.reconcileFromInterCharge(payment, interCharge);
        synced += result.synced ? 1 : 0;
        paid += result.status === InterPaymentStatus.PAID && result.synced ? 1 : 0;
        results.push({
          payment: toInterPaymentDto(result.payment || payment),
          status: result.status,
          synced: result.synced,
          txid: payment.txid,
        });
      } catch (error) {
        errors += 1;
        results.push({
          error: error instanceof Error ? error.message : String(error),
          synced: false,
          txid: payment?.txid || null,
        });
      }
    }

    return toInterSyncDto({
      checked: payments.length,
      errors,
      paid,
      results,
      synced,
    });
  }

  async processarWebhook(input = {}) {
    const values = validateWebhookInput(input);
    const validationMode = this.validateWebhookSignature(values.headers);
    const events = extractWebhookEvents(values.body);
    const results = [];
    let processed = 0;
    let duplicates = 0;
    let errors = 0;

    for (const event of events) {
      try {
        const normalized = normalizeWebhookEvent(event);
        const eventHash = buildWebhookEventHash(normalized, values.body);
        const webhookEvent = await this.repository.recordWebhookEvent({
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
          ? await this.repository.findPaymentByTxid(normalized.txid)
          : null;

        if (!payment) {
          const message = "Pagamento local nao encontrado para evento Banco Inter.";
          await this.repository.markWebhookEventProcessed({
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

        const updatedPayment = await this.repository.reconcilePayment({
          e2eid: normalized.e2eid,
          interTransactionId: normalized.interTransactionId,
          paidAt: normalized.paidAt,
          payment,
          reason: normalized.reason,
          status: normalized.status,
          webhookPayload: values.body,
        });

        await this.repository.markWebhookEventProcessed({ eventHash });
        processed += 1;
        results.push({
          payment: toInterPaymentDto(updatedPayment),
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

    return toWebhookDto({
      duplicates,
      errors,
      processed,
      results,
      validationMode,
    });
  }

  validateWebhookSignature(headers = {}) {
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
        INTER_WEBHOOK_SIGNATURE_INVALID_CODE,
      );
    }

    return "shared-secret";
  }

  async reconcileFromInterCharge(payment, interCharge = {}) {
    const status = normalizeInterChargeStatus(interCharge);

    if (status === InterPaymentStatus.PENDING || status === InterPaymentStatus.PROCESSING) {
      return {
        payment,
        status,
        synced: false,
      };
    }

    const pixEvent = extractFirstPixEvent(interCharge);
    const updatedPayment = await this.repository.reconcilePayment({
      e2eid: pixEvent?.endToEndId ?? pixEvent?.e2eid,
      interTransactionId: pixEvent?.id ?? interCharge?.loc?.id,
      paidAt: pixEvent?.horario ?? interCharge?.calendario?.criacao,
      payment,
      reason: interCharge?.status,
      status,
      webhookPayload: interCharge,
    });

    return {
      payment: updatedPayment,
      status,
      synced: true,
    };
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

function normalizeWebhookStatus(event = {}) {
  const explicitType = String(event.tipo ?? event.eventType ?? event.evento ?? "").toUpperCase();
  const status = String(event.status ?? event.cob?.status ?? "").toUpperCase();

  if (
    explicitType.includes("DEVOL") ||
    status.includes("DEVOL") ||
    Array.isArray(event.devolucoes)
  ) {
    return InterPaymentStatus.REFUNDED;
  }

  if (explicitType.includes("CANCEL") || status.includes("REMOVIDA") || status.includes("CANCEL")) {
    return InterPaymentStatus.CANCELLED;
  }

  if (explicitType.includes("EXPIR") || status.includes("EXPIR")) {
    return InterPaymentStatus.EXPIRED;
  }

  if (status) {
    return normalizeInterPaymentStatus(status);
  }

  return InterPaymentStatus.PAID;
}

function normalizeInterChargeStatus(interCharge = {}) {
  const status = String(interCharge.status ?? "").toUpperCase();

  if (Array.isArray(interCharge.pix) && interCharge.pix.length > 0) {
    return InterPaymentStatus.PAID;
  }

  if (status.includes("CONCLUID")) return InterPaymentStatus.PAID;
  if (status.includes("REMOVIDA") || status.includes("CANCEL")) return InterPaymentStatus.CANCELLED;
  if (status.includes("EXPIR")) return InterPaymentStatus.EXPIRED;
  if (status.includes("ATIVA")) return InterPaymentStatus.PENDING;

  return normalizeInterPaymentStatus(status);
}

function extractFirstPixEvent(interCharge = {}) {
  return Array.isArray(interCharge.pix) ? interCharge.pix[0] || null : null;
}

function extractPaymentLink(payload = {}) {
  return (
    nullableText(payload?.loc?.location, 1000) ||
    nullableText(payload?.location, 1000) ||
    nullableText(payload?.linkPagamento, 1000) ||
    nullableText(payload?.paymentLink, 1000)
  );
}

function buildWebhookEventHash(event, payload) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        e2eid: event.e2eid,
        payloadStatus: payload?.status ?? null,
        status: event.status,
        txid: event.txid,
      }),
    )
    .digest("hex");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""));
  const rightBuffer = Buffer.from(String(right ?? ""));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = {
  INTER_CHARGE_NOT_FOUND_CODE,
  INTER_PAYMENT_NOT_FOUND_CODE,
  INTER_WEBHOOK_SIGNATURE_INVALID_CODE,
  InterApplicationService,
  buildWebhookEventHash,
  extractWebhookEvents,
  normalizeInterChargeStatus,
  normalizeWebhookEvent,
};
