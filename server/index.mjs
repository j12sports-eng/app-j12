import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import dotenv from "dotenv";
import alunoRoutes from "./routes/aluno.mjs";

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

dotenv.config();

const backendRequire = createRequire(new URL("../backend/package.json", import.meta.url));
const express = backendRequire("express");
const { default: dbModule } = await import("../backend/db.js");
const { default: authModule } = await import("../backend/auth.js");
const { default: authRoutes } = await import("../backend/routes/auth.js");

const {
  pool,
  query,
  testConnection,
  ensureAuthSchema,
  ensureSchema,
  syncEnrollmentNumberRegistry,
} = dbModule;
const {
  authenticateUserDetailed,
  createSession,
  deleteSession,
  ensureAuthSeedData,
  getTokenFromRequest,
  getUserBySessionToken,
} = authModule;

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || "3001");
const NODE_ENV = process.env.NODE_ENV || "development";
const REQUEST_BODY_LIMIT_BYTES = Number(process.env.REQUEST_BODY_LIMIT_BYTES || 1024 * 1024);

const defaultCorsOrigins = [
  "https://app.j12sports.com.br",
  "https://hml.app.j12sports.com.br",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5174",
  "http://localhost:5174",
];

function normalizeCorsOrigin(origin) {
  const value = String(origin || "")
    .trim()
    .replace(/\/+$/, "");
  if (!value) return "";
  if (value === "*") return "*";

  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

const configuredCorsOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map(normalizeCorsOrigin)
  .filter(Boolean);

const allowAnyOrigin = configuredCorsOrigins.includes("*");
const allowedCorsOrigins = new Set([
  ...defaultCorsOrigins.map(normalizeCorsOrigin),
  ...configuredCorsOrigins,
]);

const databaseState = {
  ok: false,
  authSchemaReady: false,
  schemaReady: false,
  schemaError: null,
  checkedAt: null,
  error: null,
};

let authSchemaInitPromise = null;

const routeDefinitions = [
  { mountPath: "/aluno", modulePath: "./src/routes/aluno.routes.js" },
  { mountPath: "/aluno-completo", modulePath: "./src/routes/aluno-completo.routes.js" },
  { mountPath: "/alunos", modulePath: "./src/routes/alunos.routes.js" },

  { mountPath: "/financeiro", modulePath: "./src/routes/financeiro.routes.js" },
  { mountPath: "/modalidades", modulePath: "./src/routes/modalidades.routes.js" },
  { mountPath: "/planos", modulePath: "./src/routes/planos.routes.js" },
  { mountPath: "/professores", modulePath: "./src/routes/professores.routes.js" },
  { mountPath: "/public", modulePath: "./src/routes/public.routes.js" },
  { mountPath: "/responsaveis", modulePath: "./src/routes/responsaveis.routes.js" },
  { mountPath: "/responsavel", modulePath: "./src/routes/responsaveis.routes.js" },
  { mountPath: "/api/responsaveis", modulePath: "./src/routes/responsaveis.routes.js" },
  { mountPath: "/api/responsavel", modulePath: "./src/routes/responsaveis.routes.js" },
  { mountPath: "/state", modulePath: "./src/routes/state.routes.js" },
  { mountPath: "/turmas", modulePath: "./src/routes/turmas.routes.js" },
  { mountPath: "/unidades", modulePath: "./src/routes/unidades.routes.js" },

  // NOVAS ROTAS
  { mountPath: "/trial-classes", modulePath: "./routes/trial-classes.routes.js" },
  { mountPath: "/contratos", modulePath: "./routes/contratos.routes.js" },
  { mountPath: "/settings", modulePath: "./routes/settings.routes.js" },
];

const mountedRoutes = [];
const skippedRoutes = [];

function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

function serializeError(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || "Erro desconhecido.",
    code: error?.code || null,
    errno: error?.errno || null,
    statusCode: Number(error?.statusCode || error?.status || 500),
    stack: error?.stack || null,
  };
}

function createHttpError(message, statusCode, extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
}

const DATABASE_ERROR_CODES = new Set([
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_SEQUENCE_TIMEOUT",
  "PROTOCOL_ERROR",
  "ER_QUERY_INTERRUPTED",
  "ER_CON_COUNT_ERROR",
  "ER_ACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
  "ER_DBACCESS_DENIED_ERROR",
  "ER_NO_SUCH_TABLE",
  "ECONNREFUSED",
  "ECONNRESET",
  "EACCES",
  "EPERM",
  "EPIPE",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENOTFOUND",
]);

const DATABASE_ERROR_ERRNOS = new Set([
  -4092, 1040, 1041, 1045, 1049, 1146, 1205, 2002, 2003, 2013,
]);

function hasEnv(name) {
  return String(process.env[name] || "").trim().length > 0;
}

function hasAnyEnv(names) {
  return names.some(hasEnv);
}

function getMissingLoginConfig() {
  const missing = [];
  const hasDatabaseConfig =
    hasEnv("DATABASE_URL") || (hasEnv("DB_HOST") && hasEnv("DB_USER") && hasEnv("DB_NAME"));

  if (!hasDatabaseConfig) {
    missing.push("DATABASE_URL ou DB_HOST/DB_USER/DB_NAME");
  }

  if (!hasAnyEnv(["JWT_SECRET", "AUTH_JWT_SECRET", "APP_JWT_SECRET", "SESSION_SECRET"])) {
    missing.push("JWT_SECRET");
  }

  if (!hasAnyEnv(["JWT_EXPIRES", "JWT_EXPIRES_IN", "JWT_EXPIRES_IN_SECONDS"])) {
    missing.push("JWT_EXPIRES");
  }

  if (!hasEnv("NODE_ENV")) {
    missing.push("NODE_ENV");
  }

  return missing;
}

function assertLoginRuntimeConfig() {
  const missing = getMissingLoginConfig();

  if (missing.length > 0) {
    throw createHttpError(`Variaveis de ambiente ausentes: ${missing.join(", ")}.`, 500, {
      code: "CONFIG_ERROR",
      expose: true,
      missingConfig: missing,
    });
  }
}

async function ensureAuthSchemaReady(reason, context = {}) {
  if (databaseState.authSchemaReady) {
    return true;
  }

  if (!authSchemaInitPromise) {
    authSchemaInitPromise = (async () => {
      log("info", "auth.schema.begin", {
        reason,
        requestId: context?.requestId || null,
      });

      try {
        await ensureAuthSchema();
        databaseState.authSchemaReady = true;
        databaseState.schemaError = null;

        log("info", "auth.schema.ready", {
          reason,
          requestId: context?.requestId || null,
        });

        return true;
      } catch (error) {
        const details = serializeError(error);
        databaseState.authSchemaReady = false;
        databaseState.schemaError = details;

        log("error", "auth.schema.failed", {
          reason,
          requestId: context?.requestId || null,
          ...details,
        });

        throw error;
      }
    })().finally(() => {
      authSchemaInitPromise = null;
    });
  }

  return authSchemaInitPromise;
}

function isDatabaseError(error) {
  return DATABASE_ERROR_CODES.has(error?.code) || DATABASE_ERROR_ERRNOS.has(Number(error?.errno));
}

function normalizeErrorForResponse(error) {
  const databaseError = isDatabaseError(error);
  const statusCode = databaseError
    ? 503
    : Number(error?.statusCode || error?.status || error?.status_code || 500);
  const code =
    (databaseError ? "DATABASE_UNAVAILABLE" : null) ||
    error?.errorCode ||
    error?.code ||
    (databaseError ? "DATABASE_UNAVAILABLE" : statusCode === 401 ? "AUTH_ERROR" : "INTERNAL_ERROR");
  const message =
    databaseError && statusCode >= 500
      ? "Banco de dados indisponivel ou schema incompleto."
      : error?.message || "Erro interno do servidor.";
  const publicMessage =
    statusCode >= 500 && !error?.expose && !databaseError
      ? "Erro interno do servidor. Consulte os logs para mais detalhes."
      : message;

  return {
    ...serializeError(error),
    statusCode,
    code,
    message,
    publicMessage,
    databaseError,
    timestamp: new Date().toISOString(),
  };
}

function sendErrorJson(res, statusCode, payload) {
  sendJson(res, statusCode, {
    success: false,
    message: payload.message,
    code: payload.code,
    requestId: payload.requestId || null,
    timestamp: payload.timestamp || new Date().toISOString(),
    ...(payload.details ? { details: payload.details } : {}),
  });
}

function normalizeUser(user) {
  if (!user || typeof user !== "object") return null;

  const role = String(user.role || user.perfil || "aluno");

  return {
    ...user,
    role,
    perfil: String(user.perfil || role),
  };
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function logLogin(level, message, context, meta = {}) {
  const entry = {
    requestId: context?.requestId || null,
    endpoint: context?.pathname || null,
    usuarioInformado: meta.usuarioInformado || null,
    timestamp: new Date().toISOString(),
    ambiente: NODE_ENV,
    ...meta,
  };

  delete entry.password;
  delete entry.senha;

  const line = `[LOGIN] ${message}`;
  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(line, serialized);
    return;
  }

  if (level === "warn") {
    console.warn(line, serialized);
    return;
  }

  console.log(line, serialized);
}

function logLoginError(error, context, meta = {}) {
  logLogin("error", "Erro no login", context, {
    ...meta,
    errorMessage: error?.message || "Erro desconhecido.",
    errorCode: error?.code || error?.errorCode || null,
    statusCode: Number(error?.statusCode || error?.status || 500),
  });
  console.error(error);
  console.error(error?.stack);
}

function formatBodyLimit(limitBytes) {
  return `${Math.max(1024, Number(limitBytes) || 1024)}b`;
}

function resolveRouterExport(modulePath) {
  const exported = backendRequire(modulePath);
  return exported?.default ?? exported;
}

function isExpressRouter(candidate) {
  return typeof candidate === "function" && typeof candidate.use === "function";
}

const app = express();

app.disable("x-powered-by");
app.use(
  express.json({
    limit: formatBodyLimit(REQUEST_BODY_LIMIT_BYTES),
  }),
);
app.use("/aluno", alunoRoutes);
app.use("/auth", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/__api/auth", authRoutes);

app.use(
  express.urlencoded({
    extended: true,
    limit: formatBodyLimit(REQUEST_BODY_LIMIT_BYTES),
  }),
);
app.use((req, res, next) => {
  req.auth = req.auth ?? null;
  req.user = req.user ?? null;
  next();
});

for (const route of routeDefinitions) {
  try {
    const router = resolveRouterExport(route.modulePath);

    if (!isExpressRouter(router)) {
      skippedRoutes.push({
        mountPath: route.mountPath,
        modulePath: route.modulePath,
        reason: "exported-router-not-found",
      });
      continue;
    }

    // MONTAGEM DIRETA DAS ROTAS CUSTOM

    app.use(route.mountPath, router);
    mountedRoutes.push({
      mountPath: route.mountPath,
      modulePath: route.modulePath,
    });
  } catch (error) {
    skippedRoutes.push({
      mountPath: route.mountPath,
      modulePath: route.modulePath,
      reason: error?.message || "load-failed",
    });
  }
}

app.use((req, res) => {
  const timestamp = new Date().toISOString();
  sendJson(res, 404, {
    success: false,
    message: "Rota nao encontrada.",
    code: "NOT_FOUND",
    path: req.originalUrl || req.url || "/",
    method: req.method || "GET",
    requestId: req.id || null,
    timestamp,
  });
});

app.use((error, req, res, next) => {
  const details = normalizeErrorForResponse(error);

  log("error", "delegated.route.failed", {
    requestId: req.id || null,
    method: req.method || "GET",
    pathname: req.originalUrl || req.url || "/",
    ...details,
  });
  console.error(error);
  console.error(error?.stack);

  if (res.headersSent) {
    next(error);
    return;
  }

  sendErrorJson(res, details.statusCode, {
    message: details.publicMessage,
    code: details.code,
    requestId: req.id || null,
    timestamp: details.timestamp,
    details: NODE_ENV === "production" && details.statusCode >= 500 ? null : details,
  });
});

function resolveAllowedOrigin(req) {
  const origin =
    typeof req.headers.origin === "string" ? normalizeCorsOrigin(req.headers.origin) : "";
  if (!origin) return "*";
  if (allowAnyOrigin) return origin;
  if (allowedCorsOrigins.has(origin)) return origin;
  return null;
}

function getCorsAuditMeta(req, allowedOrigin = null) {
  const originReceived = typeof req.headers.origin === "string" ? req.headers.origin : null;
  const hostReceived = typeof req.headers.host === "string" ? req.headers.host : null;
  const refererReceived = typeof req.headers.referer === "string" ? req.headers.referer : null;
  const forwardedProto =
    typeof req.headers["x-forwarded-proto"] === "string"
      ? req.headers["x-forwarded-proto"].split(",")[0].trim()
      : "http";
  const requestedUrl = `${forwardedProto || "http"}://${hostReceived || `127.0.0.1:${PORT}`}${
    req.url || "/"
  }`;

  return {
    requestId: req.id || null,
    method: req.method || "GET",
    originReceived,
    originNormalized: normalizeCorsOrigin(originReceived),
    hostReceived,
    refererReceived,
    requestedUrl,
    allowedOrigin,
  };
}

function applyCors(req, res) {
  const allowedOrigin = resolveAllowedOrigin(req);
  const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const corsAllowed = !requestOrigin || Boolean(allowedOrigin);

  if (requestOrigin) {
    res.setHeader("Vary", "Origin");
  }

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  log(corsAllowed ? "info" : "warn", corsAllowed ? "cors.allowed" : "cors.blocked", {
    ...getCorsAuditMeta(req, allowedOrigin),
    configuredOrigins: Array.from(allowedCorsOrigins),
  });

  return corsAllowed;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let receivedBytes = 0;
    let completed = false;

    req.on("data", (chunk) => {
      if (completed) return;

      receivedBytes += chunk.length;
      if (receivedBytes > REQUEST_BODY_LIMIT_BYTES) {
        completed = true;
        reject(
          createHttpError("O corpo da requisicao excedeu o limite permitido.", 413, {
            code: "REQUEST_BODY_TOO_LARGE",
          }),
        );
        req.destroy();
        return;
      }

      body += chunk;
    });

    req.on("end", () => {
      if (completed) return;
      completed = true;

      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(
          createHttpError("JSON invalido no corpo da requisicao.", 400, {
            code: "INVALID_JSON",
          }),
        );
      }
    });

    req.on("error", (error) => {
      if (completed) return;
      completed = true;
      reject(error);
    });
  });
}

function delegateToApp(req, res) {
  return new Promise((resolve, reject) => {
    let settled = false;

    function cleanup() {
      res.off("finish", handleFinish);
      res.off("close", handleFinish);
    }

    function handleFinish() {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(res.statusCode || 200);
    }

    function handleError(error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }

    res.once("finish", handleFinish);
    res.once("close", handleFinish);

    try {
      app(req, res, (error) => {
        if (error) {
          handleError(error);
          return;
        }

        if (!res.headersSent && !res.writableEnded) {
          handleFinish();
        }
      });
    } catch (error) {
      handleError(error);
    }
  });
}

async function refreshDatabaseState(reason) {
  try {
    if (reason !== "login-precheck") {
      await testConnection();
    }

    const rows = await query("SELECT 1 AS ok");
    const ok = Array.isArray(rows) && Number(rows[0]?.ok || 0) === 1;

    databaseState.ok = ok;
    databaseState.checkedAt = new Date().toISOString();
    databaseState.error = null;

    log("info", "database.connection.ok", {
      reason,
      dbHost: process.env.DB_HOST || null,
      dbName: process.env.DB_NAME || null,
    });

    return ok;
  } catch (error) {
    const details = serializeError(error);

    databaseState.ok = false;
    databaseState.checkedAt = new Date().toISOString();
    databaseState.error = {
      message: details.message,
      code: details.code,
      errno: details.errno,
    };

    log("error", "database.connection.failed", {
      reason,
      ...details,
      dbHost: process.env.DB_HOST || null,
      dbName: process.env.DB_NAME || null,
    });

    return false;
  }
}

async function bootstrap() {
  log("info", "startup.begin", {
    host: HOST,
    port: PORT,
    nodeEnv: NODE_ENV,
    mountedRoutes,
    skippedRoutes,
  });

  const connected = await refreshDatabaseState("startup-precheck");
  if (!connected) {
    log("warn", "startup.continuing-without-database");
    return;
  }

  try {
    await ensureAuthSchemaReady("startup", {});
  } catch (error) {
    log("error", "startup.auth.schema.failed", serializeError(error));
  }

  try {
    log("info", "startup.schema.begin");
    await ensureSchema();
    databaseState.schemaReady = true;
    databaseState.authSchemaReady = true;
    databaseState.schemaError = null;
    log("info", "startup.schema.ready");
  } catch (error) {
    databaseState.schemaReady = false;
    databaseState.schemaError = serializeError(error);
    log("error", "startup.schema.failed", serializeError(error));
  }

  try {
    log("info", "startup.auth.seed.begin");
    await ensureAuthSeedData();
    log("info", "startup.auth.seed.ready");
  } catch (error) {
    log("error", "startup.auth.seed.failed", serializeError(error));
  }

  try {
    log("info", "startup.enrollment.registry.begin");
    await syncEnrollmentNumberRegistry();
    log("info", "startup.enrollment.registry.ready");
  } catch (error) {
    log("error", "startup.enrollment.registry.failed", serializeError(error));
  }

  await refreshDatabaseState("startup-post-init");
  log("info", "startup.complete");
}

async function handleHealth(req, res, context) {
  if (!databaseState.ok) {
    await refreshDatabaseState("health-check");
  }

  const status = databaseState.ok ? "ok" : "degraded";
  const httpStatus = databaseState.ok ? 200 : 503;

  sendJson(res, httpStatus, {
    status,
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    server: {
      host: HOST,
      port: PORT,
      nodeEnv: NODE_ENV,
    },
    database: {
      ok: databaseState.ok,
      authSchemaReady: databaseState.authSchemaReady,
      schemaReady: databaseState.schemaReady,
      schemaError: databaseState.schemaError,
      checkedAt: databaseState.checkedAt,
      host: process.env.DB_HOST || null,
      port: Number(process.env.DB_PORT || 3306),
      name: process.env.DB_NAME || null,
      error: databaseState.error,
    },
  });

  return httpStatus;
}

async function handleLogin(req, res, context) {
  let identifier = "";

  try {
    logLogin("info", "Iniciando login", context);
    logLogin("info", "Lendo body", context);

    const body = await readJsonBody(req);
    identifier = String(body.email || body.login || body.identifier || "")
      .trim()
      .toLowerCase();
    const password = String(body.senha || body.password || "");
    const loginMeta = { usuarioInformado: identifier || null };

    logLogin("info", "Validando entrada", context, {
      ...loginMeta,
      hasIdentifier: Boolean(identifier),
      hasPassword: Boolean(password),
    });

    if (!identifier || !password) {
      sendErrorJson(res, 400, {
        message: "Dados invalidos. Informe email/login e senha.",
        code: "VALIDATION_ERROR",
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        details: {
          email: Boolean(identifier),
          senha: Boolean(password),
        },
      });
      return 400;
    }

    logLogin("info", "Validando ambiente", context, loginMeta);
    assertLoginRuntimeConfig();

    logLogin("info", "Verificando banco", context, loginMeta);
    if (!databaseState.ok) {
      const connected = await refreshDatabaseState("login-precheck");
      if (!connected) {
        throw createHttpError("Banco de dados indisponivel.", 503, {
          code: "DATABASE_UNAVAILABLE",
          expose: true,
        });
      }
    }

    logLogin("info", "Validando schema de autenticacao", context, loginMeta);
    await ensureAuthSchemaReady("login-precheck", context);

    const authResult = await authenticateUserDetailed(identifier, password, {
      onStep(step, meta) {
        logLogin("info", step, context, {
          ...loginMeta,
          ...meta,
        });
      },
    });
    const user = normalizeUser(authResult.user);

    if (!user) {
      log("warn", "auth.login.invalid_credentials", {
        requestId: context.requestId,
        identifier,
        found: authResult.found,
        reason: authResult.reason,
      });

      sendErrorJson(res, 401, {
        message: "Usuario ou senha invalidos.",
        code: "AUTH_ERROR",
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
      });
      return 401;
    }

    logLogin("info", "Gerando JWT", context, {
      ...loginMeta,
      userId: user.id,
      role: user.role,
      source: user.source || null,
    });

    const token = await createSession(user);

    log("info", "auth.login.success", {
      requestId: context.requestId,
      userId: user.id,
      role: user.role,
    });
    logLogin("info", "Login concluido", context, {
      ...loginMeta,
      userId: user.id,
      role: user.role,
    });

    sendJson(res, 200, {
      success: true,
      message: "Login realizado com sucesso.",
      token,
      user,
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
    });

    return 200;
  } catch (error) {
    logLoginError(error, context, {
      usuarioInformado: identifier || null,
    });
    throw error;
  }
}

async function handleAuthMe(req, res, context) {
  const token = getTokenFromRequest(req);
  if (!token) {
    sendJson(res, 401, {
      message: "Token JWT nao informado no header Authorization.",
      requestId: context.requestId,
      errorCode: "MISSING_TOKEN",
    });
    return 401;
  }

  const user = normalizeUser(await getUserBySessionToken(token));
  if (!user) {
    sendJson(res, 401, {
      message: "Sessao invalida ou expirada. Faca login novamente.",
      requestId: context.requestId,
      errorCode: "INVALID_TOKEN",
    });
    return 401;
  }

  sendJson(res, 200, {
    success: true,
    user,
    requestId: context.requestId,
  });

  return 200;
}

async function handleLogout(req, res, context) {
  const token = getTokenFromRequest(req);
  if (token) {
    await deleteSession(token);
  }

  sendJson(res, 200, {
    success: true,
    message: "Sessao encerrada com sucesso.",
    requestId: context.requestId,
  });

  return 200;
}

async function handleGetAlunos(req, res, context) {
  const rows = await query("SELECT * FROM j12_alunos ORDER BY id DESC");
  const alunos = Array.isArray(rows) ? rows : [];

  log("info", "alunos.list.success", {
    requestId: context.requestId,
    total: alunos.length,
  });

  sendJson(res, 200, alunos, {
    "X-Total-Count": String(alunos.length),
  });

  return 200;
}

const server = createServer(async (req, res) => {
  const startedAt = Date.now();
  const requestId = randomUUID();
  const method = req.method || "GET";
  const hostHeader = req.headers.host || `127.0.0.1:${PORT}`;
  let pathname = "/";
  let statusCode = 500;

  res.setHeader("X-Request-Id", requestId);
  req.id = requestId;

  try {
    const corsAllowed = applyCors(req, res);
    if (!corsAllowed) {
      statusCode = 403;
      sendJson(res, statusCode, {
        message: "Origem nao autorizada para acessar esta API.",
        requestId,
        errorCode: "CORS_BLOCKED",
      });
      return;
    }

    if (method === "OPTIONS") {
      statusCode = 204;
      res.writeHead(statusCode);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${hostHeader}`);
    pathname = url.pathname;

    log("info", "request.start", {
      requestId,
      method,
      pathname,
      origin: req.headers.origin || null,
      userAgent: req.headers["user-agent"] || null,
    });

    const context = { requestId, method, pathname, url };

    if (pathname === "/health" && method === "GET") {
      statusCode = await handleHealth(req, res, context);
      return;
    }

    if (
      (pathname === "/auth/login" ||
        pathname === "/api/auth/login" ||
        pathname === "/__api/auth/login") &&
      method === "POST"
    ) {
      statusCode = await handleLogin(req, res, context);
      return;
    }

    if (
      (pathname === "/auth/me" || pathname === "/api/auth/me" || pathname === "/__api/auth/me") &&
      method === "GET"
    ) {
      statusCode = await handleAuthMe(req, res, context);
      return;
    }

    if (
      (pathname === "/auth/logout" ||
        pathname === "/api/auth/logout" ||
        pathname === "/__api/auth/logout") &&
      method === "POST"
    ) {
      statusCode = await handleLogout(req, res, context);
      return;
    }

    if (pathname === "/alunos" && method === "GET") {
      statusCode = await handleGetAlunos(req, res, context);
      return;
    }

    statusCode = await delegateToApp(req, res);
  } catch (error) {
    const details = normalizeErrorForResponse(error);
    statusCode = details.statusCode;

    log("error", "request.failed", {
      requestId,
      method,
      pathname,
      ...details,
    });
    console.error(error);
    console.error(error?.stack);

    if (!res.headersSent && !res.writableEnded) {
      sendErrorJson(res, statusCode, {
        message: details.publicMessage,
        code: details.code,
        requestId,
        timestamp: details.timestamp,
        details: NODE_ENV === "production" && statusCode >= 500 ? null : details,
      });
    }
  } finally {
    log("info", "request.finish", {
      requestId,
      method,
      pathname,
      statusCode,
      durationMs: Date.now() - startedAt,
    });
  }
});

async function shutdown(signal) {
  log("info", "shutdown.begin", { signal });

  server.close(() => {
    log("info", "shutdown.http.closed", { signal });
  });

  try {
    await pool.end();
    log("info", "shutdown.mysql.closed", { signal });
  } catch (error) {
    log("error", "shutdown.mysql.failed", {
      signal,
      ...serializeError(error),
    });
  } finally {
    process.exit(0);
  }
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

server.listen(PORT, HOST, () => {
  log("info", "server.listening", {
    bind: `${HOST}:${PORT}`,
    localUrl: `http://127.0.0.1:${PORT}`,
    localhostUrl: `http://localhost:${PORT}`,
    healthUrl: `http://127.0.0.1:${PORT}/health`,
    alunosUrl: `http://127.0.0.1:${PORT}/alunos`,
  });

  void bootstrap().catch((error) => {
    log("error", "startup.unhandled", serializeError(error));
  });
});
