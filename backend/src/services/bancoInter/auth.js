const axios = require("axios");

const { INTER_PIX_SCOPES } = require("./types.js");
const { createInterHttpsAgent, logInter, resolveInterBaseUrl, text } = require("./utils.js");

let tokenCache = null;

function getClientConfig() {
  const clientId = text(process.env.INTER_CLIENT_ID, 255);
  const clientSecret = text(process.env.INTER_CLIENT_SECRET, 255);

  if (!clientId || !clientSecret) {
    const error = new Error("INTER_CLIENT_ID e INTER_CLIENT_SECRET sao obrigatorios.");
    error.code = "INTER_CREDENTIALS_MISSING";
    throw error;
  }

  return {
    clientId,
    clientSecret,
    baseUrl: resolveInterBaseUrl(),
  };
}

function isTokenValid() {
  return tokenCache?.accessToken && tokenCache.expiresAt - Date.now() > 60_000;
}

function clearInterTokenCache() {
  tokenCache = null;
}

async function requestToken(attempt = 1) {
  const { clientId, clientSecret, baseUrl } = getClientConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: INTER_PIX_SCOPES.join(" "),
  });

  try {
    const response = await axios.post(`${baseUrl}/oauth/v2/token`, body.toString(), {
      httpsAgent: createInterHttpsAgent(),
      timeout: Number(process.env.INTER_TIMEOUT_MS || 20000),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const accessToken = response.data?.access_token;
    if (!accessToken) {
      const error = new Error("Banco Inter nao retornou access_token.");
      error.response = response;
      throw error;
    }

    const expiresIn = Number(response.data?.expires_in || 3600);
    tokenCache = {
      accessToken,
      tokenType: response.data?.token_type || "Bearer",
      scope: response.data?.scope || INTER_PIX_SCOPES.join(" "),
      expiresAt: Date.now() + Math.max(expiresIn - 30, 60) * 1000,
    };

    logInter("auth", "Token OAuth2 renovado com sucesso.", {
      expiresIn,
      baseUrl,
    });

    return tokenCache;
  } catch (error) {
    logInter("auth", "Falha ao autenticar no Banco Inter.", {
      attempt,
      status: error.response?.status,
      error: error.response?.data || error.message,
    });

    if (attempt < 2) {
      clearInterTokenCache();
      return requestToken(attempt + 1);
    }

    throw error;
  }
}

async function getInterAccessToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && isTokenValid()) {
    return tokenCache;
  }

  return requestToken();
}

async function interRequest(config, attempt = 1) {
  const token = await getInterAccessToken({ forceRefresh: attempt > 1 });
  const baseUrl = resolveInterBaseUrl();

  try {
    return await axios.request({
      baseURL: baseUrl,
      timeout: Number(process.env.INTER_TIMEOUT_MS || 20000),
      httpsAgent: createInterHttpsAgent(),
      ...config,
      headers: {
        ...(config.headers || {}),
        Authorization: `Bearer ${token.accessToken}`,
      },
    });
  } catch (error) {
    const shouldRetry =
      attempt < 2 &&
      [401, 403, 408, 429, 500, 502, 503, 504].includes(Number(error.response?.status));

    logInter("request", "Erro na requisicao ao Banco Inter.", {
      method: config.method,
      url: config.url,
      status: error.response?.status,
      attempt,
      retry: shouldRetry,
      error: error.response?.data || error.message,
    });

    if (shouldRetry) {
      clearInterTokenCache();
      return interRequest(config, attempt + 1);
    }

    throw error;
  }
}

module.exports = {
  clearInterTokenCache,
  getInterAccessToken,
  interRequest,
};
