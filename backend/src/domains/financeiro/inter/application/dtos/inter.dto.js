const { InterPaymentEntity } = require("../../entities/inter-payment.entity.js");

function toInterPaymentDto(payment) {
  const entity =
    payment instanceof InterPaymentEntity ? payment : new InterPaymentEntity(payment || {});

  return entity.toJSON();
}

function toInterChargeDto(input = {}) {
  const payment = toInterPaymentDto(input.payment || input);

  return {
    bancoInter: {
      charge: input.interCharge || null,
      linkPagamento: input.paymentLink || null,
      pixCopiaCola: payment.pixCopyPaste || null,
      qrCode: payment.qrCode || null,
      txid: payment.txid || input.txid || null,
    },
    cobrancaId: payment.chargeId || input.chargeId || null,
    mensalidadeId: payment.mensalidadeId || input.mensalidadeId || null,
    pagamento: payment,
  };
}

function toInterSyncDto(input = {}) {
  const results = Array.isArray(input.results) ? input.results : [];

  return {
    consultados: Number(input.checked || results.length || 0),
    erros: Number(input.errors || results.filter((item) => item.error).length || 0),
    ignorados: Number(input.skipped || 0),
    liquidados: Number(input.paid || 0),
    sincronizados: Number(input.synced || 0),
    resultados: results,
  };
}

function toWebhookDto(input = {}) {
  const results = Array.isArray(input.results) ? input.results : [];

  return {
    duplicados: Number(input.duplicates || 0),
    erros: Number(input.errors || 0),
    eventos: results.length,
    processados: Number(input.processed || 0),
    resultados: results,
    validacao: input.validationMode || "mtls",
  };
}

module.exports = {
  toInterChargeDto,
  toInterPaymentDto,
  toInterSyncDto,
  toWebhookDto,
};
