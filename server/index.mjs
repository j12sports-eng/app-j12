import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import dotenv from "dotenv";
import alunoRoutes from "./routes/aluno.mjs";
import "@/lib/socket";

dotenv.config();

const backendRequire = createRequire(new URL("../backend/package.json", import.meta.url));
const express = backendRequire("express");
const { default: dbModule } = await import("../backend/db.js");
const { default: authModule } = await import("../backend/auth.js");

const { pool, query, testConnection, ensureSchema, syncEnrollmentNumberRegistry } = dbModule;
const {
  authenticateUser,
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
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5174",
  "http://localhost:5174",
];

const configuredCorsOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const allowAnyOrigin = configuredCorsOrigins.includes("*");
const allowedCorsOrigins = new Set([...defaultCorsOrigins, ...configuredCorsOrigins]);

const databaseState = {
  ok: false,
  checkedAt: null,
  error: null,
};

const routeDefinitions = [
  { mountPath: "/aluno", modulePath: "./src/routes/aluno.routes.js" },
  { mountPath: "/aluno-completo", modulePath: "./src/routes/aluno-completo.routes.js" },
  { mountPath: "/alunos", modulePath: "./src/routes/alunos.routes.js" },
  { mountPath: "/auth", modulePath: "./src/routes/auth.routes.js" },

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
  { mountPath: "/trial-classes", modulePath: "./backend/routes/trial-classes.routes.js" },
  { mountPath: "/contratos", modulePath: "./backend/routes/contratos.routes.js" },
  { mountPath: "/settings", modulePath: "./backend/routes/settings.routes.js" },
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
app.use("/auth", authRoutes);
app.use("/aluno", alunoRoutes);

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
  sendJson(res, 404, {
    message: "Rota nao encontrada.",
    path: req.originalUrl || req.url || "/",
    method: req.method || "GET",
    requestId: req.id || null,
  });
});

app.use((error, req, res, next) => {
  const details = serializeError(error);

  log("error", "delegated.route.failed", {
    requestId: req.id || null,
    method: req.method || "GET",
    pathname: req.originalUrl || req.url || "/",
    ...details,
  });

  if (res.headersSent) {
    next(error);
    return;
  }

  sendJson(res, details.statusCode, {
    message:
      details.statusCode >= 500
        ? "Erro interno do servidor. Consulte os logs para mais detalhes."
        : details.message,
    requestId: req.id || null,
    errorCode: details.code,
    details: NODE_ENV === "production" && details.statusCode >= 500 ? undefined : details,
  });
});

function resolveAllowedOrigin(req) {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  if (!origin) return "*";
  if (allowAnyOrigin) return origin;
  if (allowedCorsOrigins.has(origin)) return origin;
  return null;
}

function applyCors(req, res) {
  const allowedOrigin = resolveAllowedOrigin(req);
  const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : "";

  if (requestOrigin) {
    res.setHeader("Vary", "Origin");
  }

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  return !requestOrigin || Boolean(allowedOrigin);
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
    await testConnection();
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
    log("info", "startup.schema.begin");
    await ensureSchema();
    log("info", "startup.schema.ready");
  } catch (error) {
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
  const body = await readJsonBody(req);
  const identifier = String(body.email || body.login || "")
    .trim()
    .toLowerCase();
  const password = String(body.senha || body.password || "");

  if (!identifier || !password) {
    sendJson(res, 400, {
      message: "Informe email/login e senha para autenticar.",
      requestId: context.requestId,
      details: {
        email: Boolean(identifier),
        senha: Boolean(password),
      },
    });
    return 400;
  }

  const user = normalizeUser(await authenticateUser(identifier, password));

  if (!user) {
    log("warn", "auth.login.invalid_credentials", {
      requestId: context.requestId,
      identifier,
    });

    sendJson(res, 401, {
      message: "Email/login ou senha invalidos.",
      requestId: context.requestId,
      errorCode: "INVALID_CREDENTIALS",
    });
    return 401;
  }

  const token = await createSession(user);

  log("info", "auth.login.success", {
    requestId: context.requestId,
    userId: user.id,
    role: user.role,
  });

  sendJson(res, 200, {
    success: true,
    message: "Login realizado com sucesso.",
    token,
    user,
    requestId: context.requestId,
  });

  return 200;
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

    if (pathname === "/auth/login" && method === "POST") {
      statusCode = await handleLogin(req, res, context);
      return;
    }

    if (pathname === "/auth/me" && method === "GET") {
      statusCode = await handleAuthMe(req, res, context);
      return;
    }

    if (pathname === "/auth/logout" && method === "POST") {
      statusCode = await handleLogout(req, res, context);
      return;
    }

    if (pathname === "/alunos" && method === "GET") {
      statusCode = await handleGetAlunos(req, res, context);
      return;
    }

    statusCode = await delegateToApp(req, res);
  } catch (error) {
    const details = serializeError(error);
    statusCode = details.statusCode;

    log("error", "request.failed", {
      requestId,
      method,
      pathname,
      ...details,
    });

    sendJson(res, statusCode, {
      message:
        statusCode >= 500
          ? "Erro interno do servidor. Consulte os logs para mais detalhes."
          : details.message,
      requestId,
      errorCode: details.code,
      details: NODE_ENV === "production" && statusCode >= 500 ? undefined : details,
    });
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
