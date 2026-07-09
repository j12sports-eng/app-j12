const { PaymentChargeEntity, PaymentEntity } = require("../../entities/payment.entity.js");

function toPaymentChargeDto(charge) {
  const entity =
    charge instanceof PaymentChargeEntity ? charge : new PaymentChargeEntity(charge || {});
  const data = entity.toJSON();

  return {
    ...data,
    gateway: {
      checkoutUrl: data.checkoutUrl,
      externalId: data.externalId,
      provider: data.provider,
      providerIntegrated: data.providerPayload?.integrated === true,
      status: data.providerPayload?.status || "LOCAL_ONLY",
    },
  };
}

function toPaymentChargeListDto(input = {}) {
  const charges = Array.isArray(input.charges) ? input.charges : [];

  return {
    items: charges.map(toPaymentChargeDto),
    limit: Number(input.limit || charges.length || 0),
    total: Number(input.total || charges.length || 0),
  };
}

function toPaymentDto(payment) {
  const entity = payment instanceof PaymentEntity ? payment : new PaymentEntity(payment || {});
  return entity.toJSON();
}

module.exports = {
  toPaymentChargeDto,
  toPaymentChargeListDto,
  toPaymentDto,
};
