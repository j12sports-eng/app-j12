const axios = require("axios");

const {
  nullableText,
  resolveInterBaseUrl,
} = require("../../../../../../services/bancoInter/utils.js");
const { MTLSService } = require("./mtls.service.js");
const { OAuthService } = require("./oauth.service.js");

class InterClient {
  constructor(options = {}) {
    this.baseUrl = nullableText(options.baseUrl, 500) || resolveInterBaseUrl();
    this.httpClient = options.httpClient || axios;
    this.mtlsService = options.mtlsService || new MTLSService(options.mtlsOptions || {});
    this.oauthService =
      options.oauthService ||
      new OAuthService({
        ...options,
        baseUrl: this.baseUrl,
        mtlsService: this.mtlsService,
      });
    this.timeoutMs = Number(options.timeoutMs || process.env.INTER_TIMEOUT_MS || 20000);
  }

  async request(config = {}, attempt = 1) {
    const token = await this.oauthService.getAccessToken({ forceRefresh: attempt > 1 });

    try {
      return await this.httpClient.request({
        baseURL: this.baseUrl,
        httpsAgent: this.mtlsService.createHttpsAgent(),
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
        this.oauthService.clearTokenCache();
        return this.request(config, attempt + 1);
      }

      throw sanitizeInterError(error, config);
    }
  }
}

function sanitizeInterError(error, config = {}) {
  if (!error || typeof error !== "object") return error;

  const sanitized = new Error(error.message || "Erro na comunicacao com Banco Inter.");
  sanitized.code = error.code || "INTER_CLIENT_REQUEST_ERROR";
  sanitized.response = {
    data: redactSensitive(error.response?.data),
    status: error.response?.status,
  };
  sanitized.request = {
    method: config.method,
    url: config.url,
  };

  return sanitized;
}

function redactSensitive(value) {
  if (!value || typeof value !== "object") return value;
  const clone = Array.isArray(value) ? [] : {};

  for (const [key, item] of Object.entries(value)) {
    if (/token|secret|senha|password|cert|key/i.test(key)) {
      clone[key] = "[REDACTED]";
      continue;
    }

    clone[key] = typeof item === "object" && item !== null ? redactSensitive(item) : item;
  }

  return clone;
}

module.exports = {
  InterClient,
  redactSensitive,
  sanitizeInterError,
};
