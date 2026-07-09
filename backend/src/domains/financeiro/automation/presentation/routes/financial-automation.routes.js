const crypto = require("node:crypto");
const express = require("express");

const {
  FinancialAutomationService,
} = require("../../application/services/financial-automation.service.js");
const {
  MySqlFinancialAutomationRepository,
} = require("../../infrastructure/repositories/mysql-financial-automation.repository.js");
const {
  PaymentProviderInter,
} = require("../../../payment/providers/inter/payment-provider-inter.js");
const {
  FinancialAutomationController,
} = require("../controllers/financial-automation.controller.js");

const FINANCIAL_AUTOMATION_ROUTE_BASE_PATH = "/admin/financeiro/automation";

function createFinancialAutomationRouter(options = {}) {
  const router = express.Router();
  const controller =
    options.controller ||
    new FinancialAutomationController({
      ...options,
      automationService: createFinancialAutomationService(options),
    });

  router.use(createAutomationRateLimit(options));
  router.use(createAutomationOriginGuard(options));
  router.use(createAutomationServiceAuth(options));

  router.get("/vencimentos", controller.listUpcoming);
  router.get("/inadimplentes", controller.listOverdue);
  router.get("/pagamentos", controller.listPayments);
  router.post("/eventos", controller.recordEvent);
  router.post("/processar", controller.process);

  return router;
}

function createFinancialAutomationService(options = {}) {
  if (options.automationService || options.service) {
    return options.automationService || options.service;
  }

  const repository =
    options.automationRepository ||
    new MySqlFinancialAutomationRepository({
      idGenerator: options.idGenerator,
      queryRunner: options.queryRunner || null,
    });
  const interSyncService =
    options.interSyncService ||
    options.interProvider ||
    new PaymentProviderInter({
      logger: options.logger,
      repository: options.interRepository,
    });

  return new FinancialAutomationService({
    interSyncService,
    repository,
  });
}

function createAutomationServiceAuth(options = {}) {
  const configuredToken = nullableText(
    options.serviceToken ||
      process.env.FINANCEIRO_AUTOMATION_SERVICE_TOKEN ||
      process.env.N8N_SERVICE_TOKEN ||
      process.env.INTERNAL_SERVICE_TOKEN,
    1000,
  );
  const logger = options.logger || console;

  return (req, res, next) => {
    if (!configuredToken) {
      logger.warn?.("[financeiro/automation] token de servico nao configurado.", {
        path: req.originalUrl || req.path,
        requestId: req.id || null,
      });

      return res.status(503).json({
        code: "FINANCIAL_AUTOMATION_TOKEN_NOT_CONFIGURED",
        error: "Token interno da automacao financeira nao configurado.",
        success: false,
      });
    }

    const received = readServiceToken(req);
    if (!received || !safeEqual(received, configuredToken)) {
      logger.warn?.("[financeiro/automation] requisicao rejeitada por token invalido.", {
        path: req.originalUrl || req.path,
        requestId: req.id || null,
      });

      return res.status(401).json({
        code: "FINANCIAL_AUTOMATION_UNAUTHORIZED",
        error: "Token interno da automacao financeira invalido.",
        success: false,
      });
    }

    return next();
  };
}

function createAutomationOriginGuard(options = {}) {
  const allowedOrigins = normalizeAllowedOrigins(
    options.allowedOrigins ||
      process.env.FINANCEIRO_AUTOMATION_ALLOWED_ORIGINS ||
      process.env.N8N_ALLOWED_ORIGINS,
  );
  const logger = options.logger || console;

  return (req, res, next) => {
    const origin = normalizeOrigin(req.headers?.origin) || normalizeOrigin(req.headers?.referer);

    if (!origin) {
      return next();
    }

    if (allowedOrigins.has("*") || allowedOrigins.has(origin)) {
      return next();
    }

    logger.warn?.("[financeiro/automation] origem rejeitada.", {
      origin,
      path: req.originalUrl || req.path,
      requestId: req.id || null,
    });

    return res.status(403).json({
      code: "FINANCIAL_AUTOMATION_ORIGIN_FORBIDDEN",
      error: "Origem nao autorizada para automacao financeira.",
      success: false,
    });
  };
}

function createAutomationRateLimit(options = {}) {
  const disabled = options.rateLimitDisabled === true;
  const windowMs = Number(
    options.rateLimitWindowMs || process.env.FINANCEIRO_AUTOMATION_RATE_LIMIT_WINDOW_MS || 60_000,
  );
  const max = Number(
    options.rateLimitMax || process.env.FINANCEIRO_AUTOMATION_RATE_LIMIT_MAX || 60,
  );
  const buckets = options.rateLimitStore || new Map();

  return (req, res, next) => {
    if (disabled || req.method === "OPTIONS") {
      return next();
    }

    const now = Date.now();
    const key = `${req.ip || req.socket?.remoteAddress || "unknown"}:${req.path}`;
    const bucket = buckets.get(key) || {
      count: 0,
      resetAt: now + windowMs,
    };

    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      return res.status(429).json({
        code: "FINANCIAL_AUTOMATION_RATE_LIMITED",
        error: "Muitas requisicoes de automacao financeira em pouco tempo.",
        success: false,
      });
    }

    return next();
  };
}

function readServiceToken(req = {}) {
  const authorization = nullableText(req.headers?.authorization, 1000);
  const bearer = authorization?.replace(/^Bearer\s+/i, "");

  return (
    nullableText(bearer, 1000) ||
    nullableText(req.headers?.["x-service-token"], 1000) ||
    nullableText(req.headers?.["x-internal-token"], 1000) ||
    nullableText(req.headers?.["x-n8n-token"], 1000)
  );
}

function normalizeAllowedOrigins(value) {
  const items = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  return new Set(items.map(normalizeOrigin).filter(Boolean));
}

function normalizeOrigin(value) {
  const normalized = nullableText(value, 1000);
  if (!normalized) return null;
  if (normalized === "*") return "*";

  try {
    return new URL(normalized).origin;
  } catch {
    return normalized.replace(/\/+$/, "");
  }
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""));
  const rightBuffer = Buffer.from(String(right ?? ""));

  return (
    leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

module.exports = {
  FINANCIAL_AUTOMATION_ROUTE_BASE_PATH,
  createAutomationOriginGuard,
  createAutomationRateLimit,
  createAutomationServiceAuth,
  createFinancialAutomationRouter,
  createFinancialAutomationService,
  normalizeAllowedOrigins,
  readServiceToken,
};
