const QRCode = require("qrcode");

const { interRequest } = require("./auth.js");
const {
  assertPaymentAccess,
  findReusablePendingPayment,
  loadChargeForPix,
  savePixPayment,
} = require("./financial.js");
const {
  buildTxid,
  logInter,
  money,
  nullableText,
  resolvePixKey,
  text,
} = require("./utils.js");

function normalizeDebtor(charge) {
  const digits = text(charge.responsibleCpf, 20).replace(/\D/g, "");
  if (![11, 14].includes(digits.length)) return null;

  return {
    nome: text(charge.responsibleName || charge.studentName || "Responsavel J12", 200),
    ...(digits.length === 11 ? { cpf: digits } : { cnpj: digits }),
  };
}

function buildPixChargePayload(charge) {
  const pixKey = resolvePixKey();
  if (!pixKey) {
    const error = new Error("INTER_PIX_KEY e obrigatoria para gerar cobrancas PIX.");
    error.code = "INTER_PIX_KEY_MISSING";
    throw error;
  }

  const debtor = normalizeDebtor(charge);
  const payload = {
    calendario: {
      expiracao: Number(process.env.INTER_PIX_EXPIRATION_SECONDS || 86400),
    },
    valor: {
      original: money(charge.amount),
    },
    chave: pixKey,
    solicitacaoPagador: text(charge.description || "Mensalidade J12 Sports", 140),
    infoAdicionais: [
      {
        nome: "Aluno",
        valor: text(charge.studentName, 72) || "Aluno J12",
      },
      {
        nome: "Origem",
        valor: "J12 Sports Hub",
      },
    ],
  };

  if (debtor) payload.devedor = debtor;

  return payload;
}

function extractPixCopyPaste(payload) {
  return (
    text(payload?.pixCopiaECola, 4096) ||
    text(payload?.pixCopiaCola, 4096) ||
    text(payload?.emv, 4096) ||
    text(payload?.payload, 4096) ||
    text(payload?.brcode, 4096)
  );
}

function normalizeQrCodeImage(value) {
  const normalized = text(value, 5 * 1024 * 1024);
  if (!normalized) return "";
  if (normalized.startsWith("data:image/")) return normalized;
  return `data:image/png;base64,${normalized}`;
}

async function generateQrCodeImage(pixCopyPaste, qrCodePayload) {
  const interImage = normalizeQrCodeImage(
    qrCodePayload?.imagemQrcode || qrCodePayload?.qrCode || qrCodePayload?.imagemQRCode,
  );

  if (interImage) return interImage;
  if (!pixCopyPaste) return "";

  return QRCode.toDataURL(pixCopyPaste, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 360,
    color: {
      dark: "#111111",
      light: "#ffffff",
    },
  });
}

async function fetchPixQrCode(txid) {
  try {
    const response = await interRequest({
      method: "GET",
      url: `/pix/v2/cob/${encodeURIComponent(txid)}/qrcode`,
    });

    return response.data || {};
  } catch (error) {
    logInter("pix", "Nao foi possivel obter QR Code pelo endpoint do Inter.", {
      txid,
      status: error.response?.status,
      error: error.response?.data || error.message,
    });
    return {};
  }
}

function formatPaymentResponse(payment) {
  return {
    txid: payment.txid,
    qrCode: payment.qrCode || "",
    pixCopiaCola: payment.pixCopyPaste || "",
    pixCopiaColaFormatado: payment.pixCopyPaste || "",
    valor: money(payment.amount),
    status: payment.status,
    paymentId: payment.id,
    mensalidadeId: payment.mensalidadeId,
    chargeId: payment.chargeId,
  };
}

async function createPixCharge({ mensalidadeId, chargeId, id, user }) {
  const charge = await loadChargeForPix({ mensalidadeId, chargeId, id });
  await assertPaymentAccess(user, charge);

  if (charge.amount <= 0) {
    const error = new Error("Cobranca sem valor valido para gerar PIX.");
    error.statusCode = 400;
    throw error;
  }

  const reusable = await findReusablePendingPayment(charge);
  if (reusable) {
    logInter("pix", "PIX pendente reutilizado para a cobranca.", {
      txid: reusable.txid,
      chargeId: charge.chargeId,
      mensalidadeId: charge.mensalidadeId,
    });
    return formatPaymentResponse(reusable);
  }

  const txid = buildTxid(`${charge.chargeId || charge.mensalidadeId || charge.studentId}`);
  const payload = buildPixChargePayload(charge);

  logInter("pix", "Criando cobranca PIX no Banco Inter.", {
    txid,
    chargeId: charge.chargeId,
    mensalidadeId: charge.mensalidadeId,
    studentId: charge.studentId,
    amount: charge.amount,
  });

  const response = await interRequest({
    method: "PUT",
    url: `/pix/v2/cob/${encodeURIComponent(txid)}`,
    data: payload,
  });

  const qrCodePayload = await fetchPixQrCode(txid);
  const pixCopyPaste =
    extractPixCopyPaste(qrCodePayload) ||
    extractPixCopyPaste(response.data) ||
    nullableText(response.data?.loc?.location, 4096);
  const qrCode = await generateQrCodeImage(pixCopyPaste, qrCodePayload);

  if (!pixCopyPaste) {
    const error = new Error("Banco Inter criou a cobranca, mas nao retornou payload copia e cola.");
    error.code = "INTER_PIX_PAYLOAD_MISSING";
    error.details = {
      txid,
      response: response.data,
      qrCodePayload,
    };
    throw error;
  }

  const payment = await savePixPayment({
    charge,
    txid,
    pixPayload: {
      request: payload,
      charge: response.data,
      qrcode: qrCodePayload,
    },
    pixCopyPaste,
    qrCode,
  });

  return formatPaymentResponse(payment);
}

async function getPixCharge(txid) {
  const response = await interRequest({
    method: "GET",
    url: `/pix/v2/cob/${encodeURIComponent(txid)}`,
  });

  return response.data;
}

async function configurePixWebhook(webhookUrl = process.env.INTER_WEBHOOK_URL) {
  const pixKey = resolvePixKey();
  const normalizedWebhookUrl = text(webhookUrl, 1000);

  if (!pixKey) {
    const error = new Error("INTER_PIX_KEY e obrigatoria para configurar webhook PIX.");
    error.code = "INTER_PIX_KEY_MISSING";
    throw error;
  }

  if (!normalizedWebhookUrl) {
    const error = new Error("INTER_WEBHOOK_URL e obrigatoria para configurar webhook PIX.");
    error.code = "INTER_WEBHOOK_URL_MISSING";
    throw error;
  }

  const response = await interRequest({
    method: "PUT",
    url: `/pix/v2/webhook/${encodeURIComponent(pixKey)}`,
    data: {
      webhookUrl: normalizedWebhookUrl,
    },
  });

  return response.data || {
    webhookUrl: normalizedWebhookUrl,
  };
}

module.exports = {
  configurePixWebhook,
  createPixCharge,
  fetchPixQrCode,
  getPixCharge,
};
