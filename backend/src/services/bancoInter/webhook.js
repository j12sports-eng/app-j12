const crypto = require("node:crypto");

const { processInterWebhookPayload } = require("./baixaAutomatica");
const { text } = require("./utils");

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""));
  const rightBuffer = Buffer.from(String(right ?? ""));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function validateInterWebhookRequest(req) {
  const secret = text(process.env.INTER_WEBHOOK_SECRET, 500);
  if (!secret) {
    return {
      valid: true,
      mode: "mtls",
    };
  }

  const received =
    text(req.headers["x-inter-signature"], 500) ||
    text(req.headers["x-webhook-token"], 500) ||
    text(req.headers["x-inter-token"], 500) ||
    text(req.headers.authorization, 500).replace(/^Bearer\s+/i, "");

  return {
    valid: Boolean(received) && safeEqual(received, secret),
    mode: "shared-secret",
  };
}

async function handleInterWebhook(req) {
  const validation = validateInterWebhookRequest(req);
  if (!validation.valid) {
    const error = new Error("Webhook Banco Inter rejeitado: assinatura/token invalido.");
    error.statusCode = 401;
    throw error;
  }

  const result = await processInterWebhookPayload(req.body || {});

  return {
    validationMode: validation.mode,
    ...result,
  };
}

module.exports = {
  handleInterWebhook,
  validateInterWebhookRequest,
};
