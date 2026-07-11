const { PaymentProvider } = require("../../application/providers/payment-provider.interface.js");
const { PaymentChargeStatus, PaymentProviderId } = require("../../entities/payment.entity.js");
const {
  InterPaymentStatus,
  normalizeInterPaymentStatus,
} = require("../../../inter/entities/inter-payment.entity.js");
const {
  MySqlInterRepository,
} = require("../../../inter/infrastructure/repositories/mysql-inter.repository.js");
const {
  toInterPixChargeDto,
  toInterProviderResultDto,
  toInterSyncDto,
} = require("./dtos/inter-provider.dto.js");
const { PixService } = require("./services/pix.service.js");
const { WebhookService } = require("./services/webhook.service.js");
const {
  controlledError,
  validateCreatePixInput,
  validateSyncInput,
  validateTxidInput,
} = require("./validators/inter-provider.validators.js");

const INTER_PROVIDER_CHARGE_NOT_FOUND_CODE = "INTER_PROVIDER_CHARGE_NOT_FOUND";
const INTER_PROVIDER_PAYMENT_NOT_FOUND_CODE = "INTER_PROVIDER_PAYMENT_NOT_FOUND";

class PaymentProviderInter extends PaymentProvider {
  constructor(options = {}) {
    super({
      displayName: "Banco Inter",
      id: PaymentProviderId.BANCO_INTER,
    });
    this.repository =
      options.repository || options.interRepository || new MySqlInterRepository(options);
    this.pixService = options.pixService || new PixService(options.pixOptions || options);
    this.webhookService =
      options.webhookService ||
      new WebhookService({
        repository: this.repository,
        webhookSecret: options.webhookSecret,
      });
  }

  async createCharge(input = {}) {
    const data = await this.createPix(input);

    return toInterProviderResultDto({
      issued: {
        paymentLink: data.bancoInter.linkPagamento,
        pixCopyPaste: data.bancoInter.pixCopiaCola,
        qrCode: data.bancoInter.qrCode,
        txid: data.txid,
      },
      payment: data.pagamento,
      status: PaymentChargeStatus.ISSUED,
    });
  }

  async updateCharge(input = {}) {
    const txid = input.txid || input.externalId;
    if (!txid) {
      return this.createCharge(input);
    }

    return this.getCharge({ txid });
  }

  async cancelCharge(input = {}) {
    const txid = input.txid || input.externalId;
    const data = await this.cancelPix({
      reason: input.reason,
      txid,
    });

    return {
      ...toInterProviderResultDto({
        interCharge: data.bancoInter.charge,
        payment: data.pagamento,
        status: PaymentChargeStatus.CANCELLED,
        txid: data.txid,
      }),
      status: PaymentChargeStatus.CANCELLED,
    };
  }

  async getCharge(input = {}) {
    const data = await this.getPix(input);

    return toInterProviderResultDto({
      interCharge: data.bancoInter.charge,
      payment: data.pagamento,
      status: data.pagamento?.status || PaymentChargeStatus.PENDING,
      txid: data.txid,
    });
  }

  async listPayments(input = {}) {
    return this.sync(input);
  }

  async createPix(input = {}) {
    const values = validateCreatePixInput(input);
    const charge = await this.resolveChargeForPix(values);
    const issued = await this.pixService.createPixCharge({
      ...charge,
      ...values,
      amount: values.amount || charge.amount,
      chargeId: charge.chargeId,
      description: values.description || charge.description,
      mensalidadeId: charge.mensalidadeId,
      responsibleCpf: values.responsibleCpf || charge.responsibleCpf,
      responsibleName: values.responsibleName || charge.responsibleName,
      studentName: values.studentName || charge.studentName,
    });
    const payment = await this.getRepository().saveIssuedCharge({
      charge,
      interCharge: issued.interCharge,
      interTransactionId: issued.interCharge?.loc?.id || null,
      paymentLink: issued.paymentLink,
      pixCopyPaste: issued.pixCopyPaste,
      qrCode: issued.qrCode,
      requestPayload: issued.requestPayload,
      responsePayload: issued.responsePayload,
      txid: issued.txid,
    });

    return toInterPixChargeDto({
      chargeId: charge.chargeId,
      issued,
      mensalidadeId: charge.mensalidadeId,
      payment,
    });
  }

  async getPix(input = {}) {
    const values = validateTxidInput(input);
    const payment = await this.getRepository().findPaymentByTxid(values.txid);
    const interCharge = await this.pixService.getPixCharge(values.txid);
    const reconciliation = payment
      ? await this.reconcileFromInterCharge(payment, interCharge)
      : { payment: null, status: normalizeInterChargeStatus(interCharge), synced: false };

    return toInterPixChargeDto({
      interCharge,
      payment: reconciliation.payment || payment,
      txid: values.txid,
    });
  }

  async cancelPix(input = {}) {
    const values = validateTxidInput(input);
    const payment = await this.getRepository().findPaymentByTxid(values.txid);

    if (!payment) {
      throw controlledError(
        "Pagamento Banco Inter nao encontrado para cancelamento.",
        INTER_PROVIDER_PAYMENT_NOT_FOUND_CODE,
        { txid: values.txid },
      );
    }

    const interCharge = await this.pixService.cancelPixCharge(values.txid, values.reason);
    const updatedPayment = await this.getRepository().reconcilePayment({
      payment,
      reason: values.reason || "Cancelamento solicitado no financeiro J12",
      status: InterPaymentStatus.CANCELLED,
      webhookPayload: interCharge,
    });

    return toInterPixChargeDto({
      interCharge,
      payment: updatedPayment,
      txid: values.txid,
    });
  }

  async sync(input = {}) {
    const values = validateSyncInput(input);
    const payments = values.id
      ? [await this.getRepository().findPayment(values)].filter(Boolean)
      : await this.getRepository().listOpenPayments({ limit: values.limit });
    const results = [];
    let paid = 0;
    let synced = 0;
    let errors = 0;

    for (const payment of payments) {
      try {
        const interCharge = await this.pixService.getPixCharge(payment.txid);
        const result = await this.reconcileFromInterCharge(payment, interCharge);
        synced += result.synced ? 1 : 0;
        paid += result.status === InterPaymentStatus.PAID && result.synced ? 1 : 0;
        results.push({
          payment: result.payment || payment,
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

  async processWebhook(input = {}) {
    return this.webhookService.processWebhook(input);
  }

  async resolveChargeForPix(values = {}) {
    const charge = await this.getRepository().findChargeForInter(values);

    if (charge) {
      return charge;
    }

    if (values.amount > 0 && values.studentId && values.description) {
      return {
        amount: values.amount,
        chargeId: values.chargeId,
        description: values.description,
        dueDate: values.dueDate,
        mensalidadeId: values.mensalidadeId,
        responsibleCpf: values.responsibleCpf,
        responsibleId: values.responsibleId,
        responsibleName: values.responsibleName,
        source: "payment_provider",
        studentId: values.studentId,
        studentName: values.studentName || "Aluno J12",
      };
    }

    throw controlledError(
      "Cobranca financeira nao encontrada para emissao PIX Banco Inter.",
      INTER_PROVIDER_CHARGE_NOT_FOUND_CODE,
      values,
    );
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
    assertPaidAmountMatches(
      payment,
      pixEvent?.valor ?? pixEvent?.amount ?? interCharge?.valor?.original,
      status,
    );
    const updatedPayment = await this.getRepository().reconcilePayment({
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

  getRepository() {
    if (!this.repository || typeof this.repository.findChargeForInter !== "function") {
      throw new TypeError("PaymentProviderInter requires Banco Inter repository.");
    }

    return this.repository;
  }
}

function assertPaidAmountMatches(payment, receivedAmount, status) {
  if (status !== InterPaymentStatus.PAID || receivedAmount == null || receivedAmount === "") return;

  const expectedCents = moneyToCents(payment?.amount);
  const receivedCents = moneyToCents(receivedAmount);
  if (expectedCents === null || receivedCents === null || expectedCents !== receivedCents) {
    const error = new Error(
      "Valor recebido no Pix diverge do valor integral da cobranca; baixa automatica bloqueada.",
    );
    error.code = "INTER_PROVIDER_PAYMENT_AMOUNT_MISMATCH";
    throw error;
  }
}

function moneyToCents(value) {
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
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
  return Array.isArray(interCharge.pix) && interCharge.pix.length > 0 ? interCharge.pix[0] : null;
}

module.exports = {
  INTER_PROVIDER_CHARGE_NOT_FOUND_CODE,
  INTER_PROVIDER_PAYMENT_NOT_FOUND_CODE,
  PaymentProviderInter,
  assertPaidAmountMatches,
  extractFirstPixEvent,
  normalizeInterChargeStatus,
};
