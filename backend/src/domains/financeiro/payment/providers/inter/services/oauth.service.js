const axios = require("axios");

const { INTER_PIX_SCOPES } = require("../../../../../../services/bancoInter/types.js");
const {
  nullableText,
  resolveInterBaseUrl,
} = require("../../../../../../services/bancoInter/utils.js");
const { MTLSService } = require("./mtls.service.js");

const INTER_OAUTH_CREDENTIALS_MISSING_CODE = "INTER_OAUTH_CREDENTIALS_MISSING";
const INTER_OAUTH_TOKEN_MISSING_CODE = "INTER_OAUTH_TOKEN_MISSING";

class OAuthService {
  constructor(options = {}) {
    this.baseUrl = nullableText(options.baseUrl, 500) || resolveInterBaseUrl();
    this.clientId = nullableText(options.clientId ?? process.env.INTER_CLIENT_ID, 255);
    this.clientSecret = nullableText(options.clientSecret ?? process.env.INTER_CLIENT_SECRET, 255);
    this.httpClient = options.httpClient || axios;
    this.mtlsService = options.mtlsService || new MTLSService(options.mtlsOptions || {});
    this.now = typeof options.now === "function" ? options.now : () => Date.now();
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
        "INTER_CLIENT_ID e INTER_CLIENT_SECRET sao obrigatorios para OAuth Banco Inter.",
        INTER_OAUTH_CREDENTIALS_MISSING_CODE,
      );
    }

    const response = await this.httpClient.post(
      `${this.baseUrl}/oauth/v2/token`,
      new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "client_credentials",
        scope: this.scopes.join(" "),
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        httpsAgent: this.mtlsService.createHttpsAgent(),
        timeout: this.timeoutMs,
      },
    );
    const accessToken = nullableText(response?.data?.access_token, 4096);

    if (!accessToken) {
      throw controlledError(
        "Banco Inter nao retornou access_token.",
        INTER_OAUTH_TOKEN_MISSING_CODE,
      );
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
  INTER_OAUTH_CREDENTIALS_MISSING_CODE,
  INTER_OAUTH_TOKEN_MISSING_CODE,
  OAuthService,
};
