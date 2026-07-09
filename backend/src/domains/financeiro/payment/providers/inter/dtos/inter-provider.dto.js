function toInterPixChargeDto(input = {}) {
  const payment = input.payment || null;
  const issued = input.issued || {};
  const interCharge = input.interCharge || issued.interCharge || null;
  const txid = issued.txid || payment?.txid || input.txid || null;

  return {
    bancoInter: {
      charge: interCharge,
      linkPagamento: issued.paymentLink || input.paymentLink || null,
      pixCopiaCola: issued.pixCopyPaste || payment?.pixCopyPaste || null,
      qrCode: issued.qrCode || payment?.qrCode || null,
      txid,
    },
    cobrancaId: payment?.chargeId || input.chargeId || null,
    mensalidadeId: payment?.mensalidadeId || input.mensalidadeId || null,
    pagamento: payment,
    provider: "banco_inter",
    txid,
  };
}

function toInterProviderResultDto(input = {}) {
  const pix = toInterPixChargeDto(input);

  return {
    ...pix,
    checkoutUrl: pix.bancoInter.linkPagamento,
    externalId: pix.txid,
    integrated: true,
    pixCopyPaste: pix.bancoInter.pixCopiaCola,
    provider: "banco_inter",
    qrCode: pix.bancoInter.qrCode,
    status: input.status || input.payment?.status || "PENDENTE",
  };
}

function toInterSyncDto(input = {}) {
  const results = Array.isArray(input.results) ? input.results : [];

  return {
    consultados: Number(input.checked || results.length || 0),
    erros: Number(input.errors || results.filter((item) => item.error).length || 0),
    liquidados: Number(input.paid || 0),
    provider: "banco_inter",
    resultados: results,
    sincronizados: Number(input.synced || 0),
  };
}

function toInterWebhookDto(input = {}) {
  const results = Array.isArray(input.results) ? input.results : [];

  return {
    duplicados: Number(input.duplicates || 0),
    erros: Number(input.errors || 0),
    eventos: results.length,
    processados: Number(input.processed || 0),
    provider: "banco_inter",
    resultados: results,
    validacao: input.validationMode || "mtls",
  };
}

module.exports = {
  toInterPixChargeDto,
  toInterProviderResultDto,
  toInterSyncDto,
  toInterWebhookDto,
};
