const path = require("node:path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const authRoutes = require("../routes/auth");
const alunosRoutes = require("./routes/alunos.routes");
const modalidadesRoutes = require("./routes/modalidades.routes");
const professoresRoutes = require("./routes/professores.routes");
const publicRoutes = require("./routes/public.routes");
const financeiroRoutes = require("./routes/financeiro.routes");
const responsaveisRoutes = require("./routes/responsaveis.routes");
const stateRoutes = require("./routes/state.routes");
const planosRoutes = require("./routes/planos.routes");
const turmasRoutes = require("./routes/turmas.routes");
const unidadesRoutes = require("./routes/unidades.routes");
const alunoCompletoRoutes = require("./routes/aluno-completo.routes");
const alunoRoutes = require("./routes/aluno.routes");

const {
  ensureSchema,
  pool,
  syncJ12FinanceFromLegacy,
  syncEnrollmentNumberRegistry,
  syncJ12TablesFromLegacy,
  testConnection,
} = require("./config/db");
const {
  ensurePortalAlunoSchema,
  syncPortalAlunoCompatibilityData,
} = require("./services/portal-schema.service");

const { ensureAuthSeedData } = require("../auth");
const { deactivateOrphanStudentUsers, syncStudentUsers } = require("../services/student-users");
const {
  deactivateOrphanProfessorUsers,
  deactivateOrphanResponsavelUsers,
  syncProfessorUsers,
  syncResponsavelUsers,
} = require("../services/linked-users");
const {
  generateMonthlyCharges,
  syncAllChargeCompatibilityTables,
} = require("../services/student-finance");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

function createApp() {
  const app = express();
  const defaultCorsOrigins = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "https://app.j12sports.com.br",
  ];
  const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const allowedOrigins = Array.from(new Set([...defaultCorsOrigins, ...configuredOrigins]));

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/", (_req, res) => {
    res.json({ status: "API J12 ONLINE" });
  });

  app.get("/health", async (_req, res, next) => {
    try {
      await pool.query("SELECT 1 AS ok");
      res.json({ ok: true, service: "j12-mysql-api" });
    } catch (error) {
      next(error);
    }
  });

  app.use("/auth", authRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/alunos", alunosRoutes);
  app.use("/api/alunos", alunosRoutes);
  app.use("/turmas", turmasRoutes);
  app.use("/api/turmas", turmasRoutes);
  app.use("/modalidades", modalidadesRoutes);
  app.use("/api/modalidades", modalidadesRoutes);
  app.use("/unidades", unidadesRoutes);
  app.use("/api/unidades", unidadesRoutes);
  app.use("/professores", professoresRoutes);
  app.use("/api/professores", professoresRoutes);
  app.use("/responsaveis", responsaveisRoutes);
  app.use("/api/responsaveis", responsaveisRoutes);
  app.use("/public", publicRoutes);
  app.use("/financeiro", financeiroRoutes);
  app.use("/api/financeiro", financeiroRoutes);
  app.use("/api/state", stateRoutes);
  app.use("/planos", planosRoutes);
  app.use("/api/planos", planosRoutes);
  app.use("/aluno-completo", alunoCompletoRoutes);
  app.use("/api/aluno-completo", alunoCompletoRoutes);
  app.use("/aluno", alunoRoutes);
  app.use("/api/aluno", alunoRoutes);

  app.use((_req, res) => {
    res.status(404).json({ message: "Rota não encontrada" });
  });

  app.use((error, _req, res, _next) => {
    const status = Number(error?.statusCode || error?.status || 500);
    const message =
      error instanceof Error ? error.message : "Nao foi possivel processar a requisicao.";

    console.error("[api] Erro nao tratado:", {
      status,
      message,
      code: error?.code,
    });

    res.status(status).json({ message });
  });

  return app;
}

async function runTask(name, task) {
  console.log(`[startup] ${name}...`);
  const result = await task();
  console.log(`[startup] ${name} OK`);
  return result;
}

async function runBackgroundTask(name, task) {
  try {
    await runTask(name, task);
  } catch (error) {
    console.error(`[startup] ${name} falhou:`, error?.message || error);
  }
}

async function initializeCriticalServices() {
  console.log("[startup] Inicializando servicos criticos...");

  await runTask("ensureSchema", ensureSchema);
  await runTask("syncJ12TablesFromLegacy", syncJ12TablesFromLegacy);
  await runTask("syncJ12FinanceFromLegacy", syncJ12FinanceFromLegacy);
  await runTask("syncEnrollmentNumberRegistry", syncEnrollmentNumberRegistry);
  await runTask("ensureAuthSeedData", ensureAuthSeedData);
  await runTask("ensurePortalAlunoSchema", ensurePortalAlunoSchema);
  await runTask("syncPortalAlunoCompatibilityData", syncPortalAlunoCompatibilityData);

  console.log("[startup] Servicos criticos prontos.");
}

async function initializeBackgroundServices() {
  console.log("[startup] Iniciando sincronizacoes em segundo plano...");

  await runBackgroundTask("deactivateOrphanStudentUsers", deactivateOrphanStudentUsers);
  await runBackgroundTask("deactivateOrphanProfessorUsers", deactivateOrphanProfessorUsers);
  await runBackgroundTask("deactivateOrphanResponsavelUsers", deactivateOrphanResponsavelUsers);
  await runBackgroundTask("syncProfessorUsers", syncProfessorUsers);
  await runBackgroundTask("syncResponsavelUsers", syncResponsavelUsers);
  await runBackgroundTask("syncStudentUsers", syncStudentUsers);
  await runBackgroundTask("generateMonthlyCharges", () =>
    generateMonthlyCharges({ actorName: "startup" }),
  );
  await runBackgroundTask("syncAllChargeCompatibilityTables", syncAllChargeCompatibilityTables);

  console.log("[startup] Sincronizacoes em segundo plano concluidas.");
}

async function startServer() {
  console.log("[startup] Iniciando API J12...");

  const app = createApp();
  const port = Number(process.env.PORT || 3001);

  console.log("[startup] Testando conexao MySQL...");
  await testConnection();

  console.log(
    `[startup] Conectado em ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  );

  await initializeCriticalServices();

  app.listen(port, "127.0.0.1", () => {
    console.log(`[startup] API J12 rodando em http://127.0.0.1:${port}`);
  });

  void initializeBackgroundServices();
}

module.exports = {
  createApp,
  startServer,
};
