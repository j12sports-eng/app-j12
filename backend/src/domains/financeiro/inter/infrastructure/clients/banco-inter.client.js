const axios = require("axios");

const {
  createInterHttpsAgent,
  money,
  nullableText,
  resolveInterBaseUrl,
  resolvePixKey,
  resolvePixTxid,
  text,
} = require("../../../../../services/bancoInter/utils.js");
const { INTER_PIX_SCOPES } = require("../../../../../services/bancoInter/types.js");

const INTER_CLIENT_CREDENTIALS_MISSING_CODE = "INTER_CLIENT_CREDENTIALS_MISSING";
const INTER_PIX_KEY_MISSING_CODE = "INTER_PIX_KEY_MISSING";

class BancoInterClient {
  constructor(options = {}) {
    this.baseUrl = nullableText(options.baseUrl, 500) || resolveInterBaseUrl();
    this.clientId = nullableText(options.clientId ?? process.env.INTER_CLIENT_ID, 255);
    this.clientSecret = nullableText(options.clientSecret ?? process.env.INTER_CLIENT_SECRET, 255);
    this.httpClient = options.httpClient || axios;
    this.httpsAgentFactory = options.httpsAgentFactory || createInterHttpsAgent;
    this.logger = options.logger || console;
    this.now = typeof options.now === "function" ? options.now : () => Date.now();
    this.pixKey = nullableText(options.pixKey ?? resolvePixKey(), 191);
    this.scopes =
      Array.isArray(options.scopes) && options.scopes.length > 0
        ? options.scopes
        : INTER_PIX_SCOPES;
    this.timeoutMs = Number(options.timeoutMs || process.env.INTER_TIMEOUT_MS || 20000);
    this.tokenCache = null;
    this.tokenRenewalSkewMs = Number(options.tokenRenewalSkewMs || 60000);
  }

  clearTokenCache() {
    this.tokenCache = null;
  }

  isTokenValid() {
    return (
      this.tokenCache?.accessToken &&
      Number(this.tokenCache.expiresAt || 0) - this.now() > this.tokenRenewalSkewMs
    );
  }

  async getAccessToken(options = {}) {
    if (!options.forceRefresh && this.isTokenValid()) {
      return this.tokenCache;
    }

    if (!this.clientId || !this.clientSecret) {
      throw controlledError(
        "INTER_CLIENT_ID e INTER_CLIENT_SECRET sao obrigatorios para autenticar no Banco Inter.",
        INTER_CLIENT_CREDENTIALS_MISSING_CODE,
      );
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "client_credentials",
      scope: this.scopes.join(" "),
    });
    const response = await this.httpClient.post(`${this.baseUrl}/oauth/v2/token`, body.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      httpsAgent: this.createHttpsAgent(),
      timeout: this.timeoutMs,
    });
    const accessToken = nullableText(response?.data?.access_token, 4096);

    if (!accessToken) {
      const error = new Error("Banco Inter nao retornou access_token.");
      error.response = response;
      throw error;
    }

    const expiresIn = Number(response?.data?.expires_in || 3600);
    this.tokenCache = {
      accessToken,
      expiresAt: this.now() + Math.max(expiresIn - 30, 60) * 1000,
      scope: response?.data?.scope || this.scopes.join(" "),
      tokenType: response?.data?.token_type || "Bearer",
    };

    return this.tokenCache;
  }

  async request(config, attempt = 1) {
    const token = await this.getAccessToken({ forceRefresh: attempt > 1 });

    try {
      return await this.httpClient.request({
        baseURL: this.baseUrl,
        httpsAgent: this.createHttpsAgent(),
        timeout: this.timeoutMs,
        ...config,
        headers: {
          ...(config.headers || {}),
          Authorization: `Bearer ${token.accessToken}`,
        },
      });
    } catch (error) {
      const retryable =
        attempt < 2 &&
        [401, 403, 408, 429, 500, 502, 503, 504].includes(Number(error?.response?.status));

      if (retryable) {
        this.clearTokenCache();
        return this.request(config, attempt + 1);
      }

      throw error;
    }
  }

  async createPixCharge(input = {}) {
    const txid = resolvePixTxid(input.txid, input.chargeId || input.mensalidadeId);
    const payload = buildPixChargePayload({
      ...input,
      pixKey: input.pixKey || this.pixKey,
    });
    const response = await this.request({
      data: payload,
      method: "PUT",
      url: `/pix/v2/cob/${encodeURIComponent(txid)}`,
    });
    const qrCodePayload = await this.getPixQrCode(txid);

    return {
      interCharge: response.data || {},
      paymentLink: extractPaymentLink(response.data),
      pixCopyPaste: extractPixCopyPaste(qrCodePayload) || extractPixCopyPaste(response.data),
      qrCode: normalizeQrCodeImage(qrCodePayload?.imagemQrcode || qrCodePayload?.qrCode),
      requestPayload: payload,
      responsePayload: response.data || {},
      txid,
    };
  }

  async getPixCharge(txid) {
    const response = await this.request({
      method: "GET",
      url: `/pix/v2/cob/${encodeURIComponent(requiredText(txid, "txid", 35))}`,
    });

    return response.data || {};
  }

  async cancelPixCharge(txid) {
    const response = await this.request({
      data: {
        status: "REMOVIDA_PELO_USUARIO_RECEBEDOR",
      },
      method: "PATCH",
      url: `/pix/v2/cob/${encodeURIComponent(requiredText(txid, "txid", 35))}`,
    });

    return response.data || {};
  }

  async getPixQrCode(txid) {
    try {
      const response = await this.request({
        method: "GET",
        url: `/pix/v2/cob/${encodeURIComponent(requiredText(txid, "txid", 35))}/qrcode`,
      });

      return response.data || {};
    } catch (error) {
      this.logger.warn?.("[financeiro/inter] QR Code Banco Inter indisponivel.", {
        error: error?.message,
        txid,
      });
      return {};
    }
  }

  createHttpsAgent() {
    return this.httpsAgentFactory();
  }
}

function buildPixChargePayload(input = {}) {
  const pixKey = nullableText(input.pixKey, 191);

  if (!pixKey) {
    throw controlledError(
      "INTER_PIX_KEY e obrigatoria para emitir cobranca Pix Banco Inter.",
      INTER_PIX_KEY_MISSING_CODE,
    );
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
    throw controlledError(`Banco Inter requer ${field}.`, "INTER_INPUT_REQUIRED", { field });
  }

  return normalized;
}

function controlledError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;

  for (const [key, value] of Object.entries(details)) {
    error[key] = value;
  }

  return error;
}

module.exports = {
  BancoInterClient,
  INTER_CLIENT_CREDENTIALS_MISSING_CODE,
  INTER_PIX_KEY_MISSING_CODE,
  buildPixChargePayload,
  extractPaymentLink,
  extractPixCopyPaste,
  normalizeDebtor,
};
