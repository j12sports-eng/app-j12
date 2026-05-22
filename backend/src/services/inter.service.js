const bancoInter = require("./bancoInter");

const {
  createPixCharge,
  getInterAccessToken,
  handleInterWebhook,
} = bancoInter;

async function gerarToken(options = {}) {
  const token = await getInterAccessToken(options);

  return {
    access_token: token.accessToken,
    token_type: token.tokenType,
    scope: token.scope,
    expires_at: new Date(token.expiresAt).toISOString(),
  };
}

module.exports = {
  ...bancoInter,
  createPixCharge,
  gerarToken,
  getInterAccessToken,
  handleInterWebhook,
};
