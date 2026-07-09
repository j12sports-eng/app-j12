const { PaymentChargeStatus, readObject } = require("../../entities/payment.entity.js");
const { toPaymentChargeDto, toPaymentChargeListDto } = require("../dtos/payment.dto.js");
const { PaymentGatewayFactory } = require("./payment-gateway.factory.js");
const {
  controlledError,
  validateCancelPaymentChargeInput,
  validateChargeLookupInput,
  validateCreatePaymentChargeInput,
  validateListPaymentChargesInput,
  validateUpdatePaymentChargeInput,
} = require("../validators/payment.validators.js");

const PAYMENT_CHARGE_NOT_FOUND_CODE = "PAYMENT_CHARGE_NOT_FOUND";

class ChargeService {
  constructor(options = {}) {
    this.gatewayFactory = options.gatewayFactory || new PaymentGatewayFactory(options);
    this.repository = options.repository || options.paymentRepository;
  }

  async createCharge(input = {}) {
    const values = validateCreatePaymentChargeInput(input);
    const provider = this.gatewayFactory.getProvider(values.provider);
    const providerResult = await provider.createCharge(values);
    const charge = await this.getRepository().createCharge({
      ...values,
      checkoutUrl: providerResult.checkoutUrl || providerResult.paymentLink || null,
      externalId: providerResult.externalId || providerResult.txid || null,
      providerPayload: providerResult,
      status: values.status || PaymentChargeStatus.PENDING,
    });

    return toPaymentChargeDto(charge);
  }

  async listCharges(input = {}) {
    const values = validateListPaymentChargesInput(input);
    const result = await this.getRepository().listCharges(values);
    const charges = Array.isArray(result) ? result : result.items || result.charges || [];

    return toPaymentChargeListDto({
      charges,
      limit: values.limit,
      total: result.total || charges.length,
    });
  }

  async getCharge(input = {}) {
    const values = validateChargeLookupInput(input);
    const charge = await this.getRepository().findChargeById(values.id);

    if (!charge) {
      throw controlledError("Cobranca financeira nao encontrada.", PAYMENT_CHARGE_NOT_FOUND_CODE, {
        id: values.id,
      });
    }

    return toPaymentChargeDto(charge);
  }

  async updateCharge(input = {}) {
    const values = validateUpdatePaymentChargeInput(input);
    const existing = await this.getCharge(values);
    const providerId = values.patch.provider || existing.provider;
    const provider = this.gatewayFactory.getProvider(providerId);
    const providerResult = await provider.updateCharge({
      ...existing,
      ...values.patch,
      id: values.id,
    });
    const metadata = {
      ...readObject(existing.metadata),
      ...readObject(values.patch.metadata),
    };
    const charge = await this.getRepository().updateCharge({
      id: values.id,
      patch: {
        ...values.patch,
        checkoutUrl: providerResult.checkoutUrl || values.patch.checkoutUrl,
        externalId: providerResult.externalId || existing.externalId || null,
        metadata,
        providerPayload: providerResult,
      },
      updatedBy: values.updatedBy,
    });

    if (!charge) {
      throw controlledError("Cobranca financeira nao encontrada.", PAYMENT_CHARGE_NOT_FOUND_CODE, {
        id: values.id,
      });
    }

    return toPaymentChargeDto(charge);
  }

  async cancelCharge(input = {}) {
    const values = validateCancelPaymentChargeInput(input);
    const existing = await this.getCharge(values);
    const provider = this.gatewayFactory.getProvider(existing.provider);
    const providerResult = await provider.cancelCharge({
      ...existing,
      reason: values.reason,
    });
    const charge = await this.getRepository().cancelCharge({
      ...values,
      providerPayload: providerResult,
    });

    if (!charge) {
      throw controlledError("Cobranca financeira nao encontrada.", PAYMENT_CHARGE_NOT_FOUND_CODE, {
        id: values.id,
      });
    }

    return toPaymentChargeDto(charge);
  }

  async deleteCharge(input = {}) {
    return this.cancelCharge({
      ...input,
      reason: input.reason || input.motivo || "Cancelamento administrativo via DELETE.",
    });
  }

  getRepository() {
    if (!this.repository || typeof this.repository.createCharge !== "function") {
      throw new TypeError("ChargeService requires payment repository.");
    }

    return this.repository;
  }
}

module.exports = {
  PAYMENT_CHARGE_NOT_FOUND_CODE,
  ChargeService,
};
