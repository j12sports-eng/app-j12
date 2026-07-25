console.log("Starting J12 API...");

require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const {
  createRequestObservabilityMiddleware,
  logHttpError,
} = require("./observability/http-observability.middleware.js");
const {
  createSecurityAuditMiddleware,
  createSecurityHeadersMiddleware,
  createSlidingWindowRateLimiter,
} = require("./security/security-hardening.js");

let SocketIOServer = null;
try {
  ({ Server: SocketIOServer } = require("socket.io"));
} catch (error) {
  console.warn("[socket] socket.io nao instalado; realtime financeiro ficara inativo.");
}

const {
  ensureSchema,
  syncEnrollmentNumberRegistry,
  syncJ12FinanceFromLegacy,
  syncJ12TablesFromLegacy,
  testConnection,
  pool,
  stopDatabaseJobs,
} = require("./config/db.js");
const { createRuntimeHealth } = require("./operations/runtime-health.js");
const { createGracefulShutdown } = require("./operations/graceful-shutdown.js");
const { ensureAuthSeedData } = require("../auth.js");

const authRoutes = require("../routes/auth.js");
const alunoMeRoutes = require("../routes/aluno-me.js");
const professorMeRoutes = require("../routes/professor-me.js");
const dashboardRoutes = require("./routes/dashboard.routes.js");
// Keep both server entrypoints on the compatible Financeiro router. It exposes
// the current endpoints first and delegates the remaining legacy routes.
const financeiroRoutes = require("./routes/financeiro.routes.js");

const alunoCompletoRoutes = require("./routes/aluno-completo.routes.js");
const alunosRoutes = require("./routes/alunos.routes.js");
const modalidadesRoutes = require("./routes/modalidades.routes.js");
const perfilRoutes = require("./routes/perfil.routes.js");
const planosRoutes = require("./routes/planos.routes.js");
const presencasRoutes = require("./routes/presencas.routes.js");
const professoresRoutes = require("./routes/professores.routes.js");
const publicRoutes = require("./routes/public.routes.js");
const responsaveisRoutes = require("./routes/responsaveis.routes.js");
const interRoutes = require("./routes/inter.routes.js");
const stateRoutes = require("./routes/state.routes.js");
const turmasRoutes = require("./routes/turmas.routes.js");
const unidadesRoutes = require("./routes/unidades.routes.js");
const {
  createEnrollmentAdminRouter,
  createEnrollmentInvitationPublicRouter,
  createEnrollmentPublicRouter,
  ENROLLMENT_ADMIN_ROUTE_BASE_PATH,
  ENROLLMENT_INVITATION_PUBLIC_ROUTE_BASE_PATH,
  ENROLLMENT_PUBLIC_ROUTE_BASE_PATH,
} = require("./domains/enrollments/presentation/routes/index.js");
const {
  createFinancialAdminRouter,
  createFinancialAutomationRouter,
  createFinancialPaymentAdminRouter,
  createFinancialInterAdminRouter,
  FINANCIAL_ADMIN_ROUTE_BASE_PATH,
  FINANCIAL_AUTOMATION_ROUTE_BASE_PATH,
  FINANCIAL_PAYMENT_ADMIN_ROUTE_BASE_PATH,
  FINANCIAL_INTER_ADMIN_ROUTE_BASE_PATH,
  createFinancialReportRouter,
  FINANCIAL_REPORT_ROUTE_BASE_PATH,
  createFinancialAutomationHistoryRouter,
  FINANCIAL_AUTOMATION_HISTORY_ROUTE_BASE_PATH,
} = require("./domains/financeiro/presentation/routes/index.js");
const {
  createAgendaAdminRouter,
  AGENDA_ADMIN_ROUTE_BASE_PATH,
} = require("./domains/agenda/presentation/routes/index.js");
const {
  createCourtRentalRouter,
  COURT_RENTAL_ROUTE_BASE_PATH,
} = require("./domains/quadras/presentation/routes/index.js");
const {
  createChampionshipAdminRouter,
  CHAMPIONSHIP_ADMIN_ROUTE_BASE_PATH,
  createChampionshipPublicRouter,
  CHAMPIONSHIP_PUBLIC_ROUTE_BASE_PATH,
} = require("./domains/campeonatos/presentation/routes/index.js");
const {
  createNotificationRouter,
  NOTIFICATION_LEGACY_ROUTE_BASE_PATH,
  NOTIFICATION_ROUTE_BASE_PATH,
} = require("./domains/notificacoes/presentation/routes/index.js");
const {
  BI_ADMIN_ROUTE_BASE_PATH,
  createBiAdminRouter,
} = require("./domains/bi/presentation/routes/index.js");

const {
  createCrmInternalRouter,
  CRM_INTERNAL_ROUTE_BASE_PATH,
} = require("./domains/crm/presentation/routes/index.js");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3001);
const REQUEST_LIMIT = process.env.REQUEST_LIMIT || "8mb";
const BOOTSTRAP_WARN_TIMEOUT_MS = Number(process.env.BOOTSTRAP_WARN_TIMEOUT_MS || 60000);
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS || 15000);

const app = express();
const server = http.createServer(app);
const enrollmentAdminRoutes = createEnrollmentAdminRouter();
const enrollmentInvitationPublicRoutes = createEnrollmentInvitationPublicRouter();
const enrollmentPublicRoutes = createEnrollmentPublicRouter();
const financialAdminRoutes = createFinancialAdminRouter();
const financialAutomationRoutes = createFinancialAutomationRouter();
const financialPaymentAdminRoutes = createFinancialPaymentAdminRouter();
const financialInterAdminRoutes = createFinancialInterAdminRouter();
const financialReportRoutes = createFinancialReportRouter();
const financialAutomationHistoryRoutes = createFinancialAutomationHistoryRouter();
const agendaAdminRoutes = createAgendaAdminRouter();
const courtRentalRoutes = createCourtRentalRouter();
const championshipAdminRoutes = createChampionshipAdminRouter();
const championshipPublicRoutes = createChampionshipPublicRouter();
const notificationRoutes = createNotificationRouter();
const biAdminRoutes = createBiAdminRouter();
const crmInternalRoutes = createCrmInternalRouter();

global.io = null;

const startupState = {
  database: "starting",
  schemaReady: false,
  lastError: null,
  startedAt: new Date().toISOString(),
  readyAt: null,
  shuttingDown: false,
};

const runtimeHealth = createRuntimeHealth({
  state: startupState,
  probeDatabase: async () => {
    await pool.query("SELECT 1");
    return true;
  },
});

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
    (statusCode === 401 ? "AUTH_ERROR" : "INTERNAL_ERROR");
  const message =
    databaseError && statusCode >= 500
      ? "Banco de dados indisponivel ou schema incompleto."
      : error?.message || "Erro interno do servidor.";
  const publicMessage =
    statusCode >= 500 && process.env.NODE_ENV === "production" && !error?.expose && !databaseError
      ? "Erro interno do servidor. Consulte os logs para mais detalhes."
      : message;

  return {
    statusCode,
    code,
    message,
    publicMessage,
    databaseError,
  };
}

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

const allowedOrigins = new Set([
  "https://app.j12sports.com.br",
  "https://hml.app.j12sports.com.br",
  "https://www.hml.app.j12sports.com.br",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",

  // FRONTEND VSCODE / DEV
  "http://localhost:8080",
  "http://127.0.0.1:8080",

  // FRONTEND VITE
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

function parseCorsOrigins(value) {
  return String(value || "")
    .split(",")
    .map(normalizeCorsOrigin)
    .filter(Boolean);
}

const configuredOrigins = [
  ...parseCorsOrigins(process.env.CORS_ORIGIN),
  ...parseCorsOrigins(process.env.CORS_ALLOWED_ORIGINS),
];

for (const origin of configuredOrigins) {
  allowedOrigins.add(origin);
}

const allowAnyOrigin = configuredOrigins.includes("*");

function resolveAllowedOrigin(origin) {
  const normalizedOrigin = normalizeCorsOrigin(origin);

  if (!normalizedOrigin) return "*";
  if (allowAnyOrigin) return normalizedOrigin;
  if (allowedOrigins.has(normalizedOrigin)) return normalizedOrigin;

  return null;
}

function getCorsRejectionReason(origin) {
  const normalizedOrigin = normalizeCorsOrigin(origin);

  if (!origin) return null;
  if (!normalizedOrigin) return "origin_header_empty";
  if (allowAnyOrigin || allowedOrigins.has(normalizedOrigin)) return null;

  let originUrl = null;
  try {
    originUrl = new URL(normalizedOrigin);
  } catch {
    return "origin_header_invalid";
  }

  const originHostWithoutWww = originUrl.hostname.replace(/^www\./, "");

  for (const allowed of allowedOrigins) {
    if (allowed === "*") continue;

    let allowedUrl = null;
    try {
      allowedUrl = new URL(allowed);
    } catch {
      continue;
    }

    const sameHost = allowedUrl.hostname === originUrl.hostname;
    const sameHostIgnoringWww = allowedUrl.hostname.replace(/^www\./, "") === originHostWithoutWww;

    if (sameHost && allowedUrl.protocol !== originUrl.protocol) {
      return `protocol_mismatch_allowed_${allowedUrl.protocol.replace(":", "")}`;
    }

    if (sameHost && allowedUrl.port !== originUrl.port) {
      return `port_mismatch_allowed_${allowedUrl.port || "default"}`;
    }

    if (sameHostIgnoringWww) {
      return "www_subdomain_variant_not_configured";
    }
  }

  return "origin_not_in_allowed_list";
}

function getCorsAuditMeta(req, allowedOrigin = null) {
  const originReceived = typeof req.headers.origin === "string" ? req.headers.origin : null;
  const hostReceived = typeof req.headers.host === "string" ? req.headers.host : null;
  const refererReceived = typeof req.headers.referer === "string" ? req.headers.referer : null;
  const forwardedProto =
    typeof req.headers["x-forwarded-proto"] === "string"
      ? req.headers["x-forwarded-proto"].split(",")[0].trim()
      : req.protocol || "http";

  return {
    method: req.method,
    originReceived,
    originNormalized: normalizeCorsOrigin(originReceived),
    hostReceived,
    refererReceived,
    requestedUrl: `${forwardedProto}://${hostReceived || req.get("host") || "localhost"}${
      req.originalUrl || req.url || "/"
    }`,
    allowedOrigin,
    rejectionReason: getCorsRejectionReason(originReceived),
  };
}

function corsAuditLogger(req, _res, next) {
  const origin = req.headers.origin;
  const allowedOrigin = resolveAllowedOrigin(origin);
  const corsAllowed = !origin || Boolean(allowedOrigin);
  const meta = {
    ...getCorsAuditMeta(req, allowedOrigin),
    allowedOrigins: Array.from(allowedOrigins),
    configuredOrigins,
  };

  if (corsAllowed) {
    console.log("[CORS] Origem validada:", JSON.stringify(meta));
  } else {
    console.warn("[CORS] Origem bloqueada:", JSON.stringify(meta));
  }

  next();
}

const corsOptions = {
  origin(origin, callback) {
    callback(null, Boolean(resolveAllowedOrigin(origin)));
  },

  credentials: true,

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "X-Request-Id",
    "X-Correlation-Id",
  ],

  exposedHeaders: ["Content-Length", "Content-Type", "X-Request-Id", "X-Correlation-Id"],

  optionsSuccessStatus: 204,
};

if (SocketIOServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: configuredOrigins.includes("*") ? "*" : Array.from(allowedOrigins),
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  global.io = io;
  io.on("connection", (socket) => {
    if (process.env.NODE_ENV !== "test") {
      console.log(`[socket] cliente conectado: ${socket.id}`);
    }
  });
}

app.use(corsAuditLogger);
app.use(cors(corsOptions));

app.use(createRequestObservabilityMiddleware());

app.use((req, res, next) => {
  const allowedOrigin = resolveAllowedOrigin(req.headers.origin);

  if (!allowedOrigin) {
    return res.status(403).json({
      success: false,
      message: "Origem nao autorizada para acessar esta API.",
      errorCode: "CORS_BLOCKED",
    });
  }

  res.header("Access-Control-Allow-Origin", allowedOrigin);

  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Request-Id, X-Correlation-Id",
  );

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// MUITO IMPORTANTE PARA PREFLIGHT
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(createSecurityHeadersMiddleware());
app.use(createSecurityAuditMiddleware());
app.use(createSlidingWindowRateLimiter());
app.use(express.json({ limit: REQUEST_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_LIMIT }));

function mount(paths, router) {
  for (const path of paths) {
    app.use(path, router);
  }
}

app.get(["/live", "/api/live"], (_req, res) => {
  const result = runtimeHealth.liveness();
  res.status(result.statusCode).json(result.body);
});

app.get(["/ready", "/api/ready", "/health", "/api/health"], async (_req, res) => {
  const result = await runtimeHealth.readiness();
  res.status(result.statusCode).json(result.body);
});

app.get("/internal/health", async (req, res) => {
  const configured = String(process.env.HEALTH_INTERNAL_TOKEN || "");
  const received = String(req.headers["x-health-token"] || "");
  if (!configured || received !== configured) {
    return res.status(404).json({ status: "not_found" });
  }
  const result = await runtimeHealth.internalHealth();
  return res.status(result.statusCode).json(result.body);
});
app.get("/api/test", (_req, res) => {
  res.json({
    success: true,
    data: {
      message: "Backend funcionando.",
    },
  });
});

app.use(interRoutes);
mount(["/auth", "/api/auth"], authRoutes);
mount(["/aluno/me", "/api/aluno/me"], alunoMeRoutes);
mount(["/professor/me", "/api/professor/me"], professorMeRoutes);
mount(["/aluno-completo", "/api/aluno-completo"], alunoCompletoRoutes);
mount(["/alunos", "/api/alunos"], alunosRoutes);
mount(["/dashboard", "/api/dashboard"], dashboardRoutes);
mount(["/financeiro", "/api/financeiro"], financeiroRoutes);
mount(
  [ENROLLMENT_ADMIN_ROUTE_BASE_PATH, `/api${ENROLLMENT_ADMIN_ROUTE_BASE_PATH}`],
  enrollmentAdminRoutes,
);
mount(
  [ENROLLMENT_PUBLIC_ROUTE_BASE_PATH, `/api${ENROLLMENT_PUBLIC_ROUTE_BASE_PATH}`],
  enrollmentPublicRoutes,
);
mount(
  [`/api${ENROLLMENT_INVITATION_PUBLIC_ROUTE_BASE_PATH}`],
  enrollmentInvitationPublicRoutes,
);

mount([CRM_INTERNAL_ROUTE_BASE_PATH, `/api${CRM_INTERNAL_ROUTE_BASE_PATH}`], crmInternalRoutes);

mount(
  [FINANCIAL_ADMIN_ROUTE_BASE_PATH, `/api${FINANCIAL_ADMIN_ROUTE_BASE_PATH}`],
  financialAdminRoutes,
);
mount(
  [FINANCIAL_PAYMENT_ADMIN_ROUTE_BASE_PATH, `/api${FINANCIAL_PAYMENT_ADMIN_ROUTE_BASE_PATH}`],
  financialPaymentAdminRoutes,
);
mount(
  [FINANCIAL_AUTOMATION_ROUTE_BASE_PATH, `/api${FINANCIAL_AUTOMATION_ROUTE_BASE_PATH}`],
  financialAutomationRoutes,
);
mount(
  [FINANCIAL_INTER_ADMIN_ROUTE_BASE_PATH, `/api${FINANCIAL_INTER_ADMIN_ROUTE_BASE_PATH}`],
  financialInterAdminRoutes,
);
mount(
  [FINANCIAL_REPORT_ROUTE_BASE_PATH, `/api${FINANCIAL_REPORT_ROUTE_BASE_PATH}`],
  financialReportRoutes,
);
mount(
  [
    FINANCIAL_AUTOMATION_HISTORY_ROUTE_BASE_PATH,
    `/api${FINANCIAL_AUTOMATION_HISTORY_ROUTE_BASE_PATH}`,
  ],
  financialAutomationHistoryRoutes,
);
mount([AGENDA_ADMIN_ROUTE_BASE_PATH, `/api${AGENDA_ADMIN_ROUTE_BASE_PATH}`], agendaAdminRoutes);
mount([COURT_RENTAL_ROUTE_BASE_PATH, `/api${COURT_RENTAL_ROUTE_BASE_PATH}`], courtRentalRoutes);
mount(
  [CHAMPIONSHIP_ADMIN_ROUTE_BASE_PATH, `/api${CHAMPIONSHIP_ADMIN_ROUTE_BASE_PATH}`],
  championshipAdminRoutes,
);
mount(
  [CHAMPIONSHIP_PUBLIC_ROUTE_BASE_PATH, `/api${CHAMPIONSHIP_PUBLIC_ROUTE_BASE_PATH}`],
  championshipPublicRoutes,
);
mount([BI_ADMIN_ROUTE_BASE_PATH, `/api${BI_ADMIN_ROUTE_BASE_PATH}`], biAdminRoutes);
mount(
  [
    NOTIFICATION_ROUTE_BASE_PATH,
    `/api${NOTIFICATION_ROUTE_BASE_PATH}`,
    NOTIFICATION_LEGACY_ROUTE_BASE_PATH,
    `/api${NOTIFICATION_LEGACY_ROUTE_BASE_PATH}`,
  ],
  notificationRoutes,
);
mount(["/modalidades", "/api/modalidades"], modalidadesRoutes);
mount(["/planos", "/api/planos"], planosRoutes);
mount(["/presencas", "/api/presencas"], presencasRoutes);
mount(["/professores", "/api/professores"], professoresRoutes);
mount(["/public", "/api/public"], publicRoutes);
mount(
  ["/responsaveis", "/api/responsaveis", "/responsavel", "/api/responsavel"],
  responsaveisRoutes,
);
mount(["/state", "/api/state"], stateRoutes);
mount(["/turmas", "/api/turmas"], turmasRoutes);
mount(["/unidades", "/api/unidades"], unidadesRoutes);
app.use(perfilRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Rota nao encontrada.",
    path: req.originalUrl || req.path || "/",
  });
});

app.use((error, req, res, _next) => {
  const details = normalizeErrorForResponse(error);
  const statusCode = details.statusCode;
  const timestamp = new Date().toISOString();
  const code = details.code;
  const requestId = req?.id || req?.headers?.["x-request-id"] || null;
  const message = details.publicMessage;

  logHttpError(error, req, {
    databaseError: details.databaseError,
    environment: process.env.NODE_ENV || "development",
    publicMessage: message,
    timestamp,
  });

  res.status(statusCode).json({
    success: false,
    message,
    code,
    requestId,
    timestamp,
  });
});

async function bootstrap() {
  startupState.database = "connecting";
  await testConnection();

  startupState.database = "migrating";
  await ensureSchema();
  startupState.schemaReady = true;

  await syncJ12TablesFromLegacy().catch((error) => {
    console.warn("Legacy alunos sync skipped:", error?.message || error);
  });
  await syncJ12FinanceFromLegacy().catch((error) => {
    console.warn("Legacy financeiro sync skipped:", error?.message || error);
  });
  await ensureAuthSeedData();
  await syncEnrollmentNumberRegistry().catch((error) => {
    console.warn("Enrollment registry sync skipped:", error?.message || error);
  });

  startupState.database = "ready";
  startupState.readyAt = new Date().toISOString();
  startupState.lastError = null;
}

function runBootstrapInBackground() {
  const bootstrapTimeout = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Bootstrap do banco excedeu ${BOOTSTRAP_WARN_TIMEOUT_MS}ms.`));
    }, BOOTSTRAP_WARN_TIMEOUT_MS);

    if (typeof timer.unref === "function") {
      timer.unref();
    }
  });

  Promise.race([bootstrap(), bootstrapTimeout])
    .then(() => {
      console.log("[OK] Banco de dados inicializado.");
    })
    .catch((error) => {
      startupState.database = "error";
      startupState.lastError = error?.message || "Falha ao inicializar banco de dados.";
      console.error("[ERROR] Falha ao inicializar banco de dados:", error);
      if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
        process.exitCode = 1;
        server.close();
      }
    });
}

async function startServer() {
  try {
    console.log("\n========================================");
    console.log("ðŸš€ INICIANDO J12 API");
    console.log("========================================\n");

    console.log(`[SERVER] Host: ${HOST}`);
    console.log(`[SERVER] Port: ${PORT}`);
    console.log(`[SERVER] Node Env: ${process.env.NODE_ENV || "development"}`);
    console.log(`[SERVER] Bootstrap Timeout: ${BOOTSTRAP_WARN_TIMEOUT_MS}ms (60s)\n`);

    server.listen(PORT, HOST, () => {
      console.log(`âœ“ [SERVER] API ouvindo em http://${HOST}:${PORT}`);
      console.log(`âœ“ [ENDPOINTS] Health: http://127.0.0.1:${PORT}/health`);
      console.log(`âœ“ [ENDPOINTS] Login: POST http://127.0.0.1:${PORT}/auth/login`);
      console.log(`âœ“ [ENDPOINTS] Test: http://127.0.0.1:${PORT}/api/test\n`);
      console.log("[SERVER] Inicializando banco de dados em background...\n");
      runBootstrapInBackground();
    });

    server.on("error", (error) => {
      console.error("[ERROR] Erro no servidor HTTP:", error);
      process.exit(1);
    });
  } catch (error) {
    console.error("[ERROR] Falha ao iniciar J12 API:", error);
    process.exit(1);
  }
}

startServer();

const gracefulShutdown = createGracefulShutdown({
  server,
  get io() {
    return global.io;
  },
  pool,
  jobs: [{ stop: stopDatabaseJobs }],
  state: startupState,
  timeoutMs: SHUTDOWN_TIMEOUT_MS,
});

function handleSignal(signal) {
  void gracefulShutdown(signal).then((result) => {
    process.exitCode = result.completed ? 0 : 1;
  });
}

process.once("SIGTERM", () => handleSignal("SIGTERM"));
process.once("SIGINT", () => handleSignal("SIGINT"));
process.on("uncaughtException", (error) => {
  console.error("uncaughtException:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
});

module.exports = {
  app,
  server,
};
