const {
  buildTxid,
  money,
  nullableText,
  resolvePixKey,
  text,
} = require("../../../../../../services/bancoInter/utils.js");
const { InterClient } = require("./inter-client.js");

const INTER_PROVIDER_PIX_KEY_MISSING_CODE = "INTER_PROVIDER_PIX_KEY_MISSING";
const INTER_PROVIDER_PIX_COPY_PASTE_MISSING_CODE = "INTER_PROVIDER_PIX_COPY_PASTE_MISSING";

class PixService {
  constructor(options = {}) {
    this.client = options.client || new InterClient(options.clientOptions || options);
    this.pixKey = nullableText(options.pixKey ?? resolvePixKey(), 191);
  }

  async createPixCharge(input = {}) {
    const txid = nullableText(input.txid, 35) || buildTxid(input.chargeId || input.mensalidadeId);
    const requestPayload = buildPixChargePayload({
      ...input,
      pixKey: input.pixKey || this.pixKey,
    });
    const response = await this.client.request({
      data: requestPayload,
      method: "PUT",
      url: `/pix/v2/cob/${encodeURIComponent(txid)}`,
    });
    const qrCodePayload = await this.getPixQrCode(txid);
    const pixCopyPaste = extractPixCopyPaste(qrCodePayload) || extractPixCopyPaste(response.data);

    if (!pixCopyPaste) {
      const error = new Error("Banco Inter nao retornou payload copia e cola para o PIX.");
      error.code = INTER_PROVIDER_PIX_COPY_PASTE_MISSING_CODE;
      error.txid = txid;
      throw error;
    }

    return {
      interCharge: response.data || {},
      paymentLink: extractPaymentLink(response.data),
      pixCopyPaste,
      qrCode: normalizeQrCodeImage(
        qrCodePayload?.imagemQrcode || qrCodePayload?.qrCode || qrCodePayload?.imagemQRCode,
      ),
      qrCodePayload,
      requestPayload,
      responsePayload: response.data || {},
      txid,
    };
  }

  async getPixCharge(txid) {
    const response = await this.client.request({
      method: "GET",
      url: `/pix/v2/cob/${encodeURIComponent(requiredText(txid, "txid", 35))}`,
    });

    return response.data || {};
  }

  async cancelPixCharge(txid, reason = "Cancelamento solicitado pelo financeiro J12") {
    const response = await this.client.request({
      data: {
        solicitacaoPagador: text(reason, 140),
        status: "REMOVIDA_PELO_USUARIO_RECEBEDOR",
      },
      method: "PATCH",
      url: `/pix/v2/cob/${encodeURIComponent(requiredText(txid, "txid", 35))}`,
    });

    return response.data || {};
  }

  async getPixQrCode(txid) {
    try {
      const response = await this.client.request({
        method: "GET",
        url: `/pix/v2/cob/${encodeURIComponent(requiredText(txid, "txid", 35))}/qrcode`,
      });

      return response.data || {};
    } catch {
      return {};
    }
  }
}

function buildPixChargePayload(input = {}) {
  const pixKey = nullableText(input.pixKey, 191);

  if (!pixKey) {
    const error = new Error("INTER_PIX_KEY e obrigatoria para emitir PIX Banco Inter.");
    error.code = INTER_PROVIDER_PIX_KEY_MISSING_CODE;
    throw error;
  }

  const payload = {
    calendario: {
      expiracao: Number(input.expiresIn || input.expiracao || 86400),
    },
    chave: pixKey,
    infoAdicionais: [
      {
        nome: "Origem",
        valor: "J12 Sports Hub",
      },
    ],
    solicitacaoPagador: text(input.description || input.descricao || "Mensalidade J12", 140),
    valor: {
      original: money(input.amount),
    },
  };
  const debtor = normalizeDebtor(input);

  if (debtor) {
    payload.devedor = debtor;
  }

  if (input.studentName) {
    payload.infoAdicionais.push({
      nome: "Aluno",
      valor: text(input.studentName, 72),
    });
  }

  return payload;
}

function normalizeDebtor(input = {}) {
  const digits = text(input.responsibleCpf ?? input.cpf ?? input.document, 20).replace(/\D/g, "");

  if (![11, 14].includes(digits.length)) {
    return null;
  }

  return {
    nome: text(input.responsibleName || input.studentName || "Responsavel J12", 200),
    ...(digits.length === 11 ? { cpf: digits } : { cnpj: digits }),
  };
}

function extractPaymentLink(payload = {}) {
  return (
    nullableText(payload?.loc?.location, 1000) ||
    nullableText(payload?.location, 1000) ||
    nullableText(payload?.linkPagamento, 1000) ||
    nullableText(payload?.paymentLink, 1000)
  );
}

function extractPixCopyPaste(payload = {}) {
  return (
    nullableText(payload?.pixCopiaECola, 4096) ||
    nullableText(payload?.pixCopiaCola, 4096) ||
    nullableText(payload?.emv, 4096) ||
    nullableText(payload?.payload, 4096) ||
    nullableText(payload?.brcode, 4096)
  );
}

function normalizeQrCodeImage(value) {
  const normalized = nullableText(value, 5 * 1024 * 1024);

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("data:image/")) {
    return normalized;
  }

  return `data:image/png;base64,${normalized}`;
}

function requiredText(value, field, max = 65535) {
  const normalized = nullableText(value, max);

  if (!normalized) {
    const error = new Error(`Banco Inter requer ${field}.`);
    error.code = "INTER_PROVIDER_INPUT_REQUIRED";
    error.field = field;
    throw error;
  }

  return normalized;
}

module.exports = {
  INTER_PROVIDER_PIX_COPY_PASTE_MISSING_CODE,
  INTER_PROVIDER_PIX_KEY_MISSING_CODE,
  PixService,
  buildPixChargePayload,
  extractPaymentLink,
  extractPixCopyPaste,
  normalizeDebtor,
  normalizeQrCodeImage,
};
