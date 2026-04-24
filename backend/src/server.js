const path = require("node:path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("../routes/auth");
const alunoMeRoutes = require("../routes/aluno-me");
const alunosRoutes = require("./routes/alunos.routes");
const publicRoutes = require("./routes/public.routes");
const financeiroRoutes = require("../routes/financeiro");
const {
  ensureSchema,
  pool,
  syncEnrollmentNumberRegistry,
  syncJ12TablesFromLegacy,
  testConnection,
} = require("./config/db");
const { ensureAuthSeedData } = require("../auth");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

function createApp() {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean)
    : true;

  app.use(cors({ origin: corsOrigin, credentials: true }));
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
  app.use("/aluno/me", alunoMeRoutes);
  app.use("/alunos", alunosRoutes);
  app.use("/public", publicRoutes);
  app.use("/financeiro", financeiroRoutes);

  app.use((error, _req, res, _next) => {
    const status = Number(error?.statusCode || error?.status || 500);
    const message =
      error instanceof Error ? error.message : "Nao foi possivel processar a requisicao.";

    console.error("[api] Erro nao tratado.", {
      status,
      message,
      code: error?.code,
    });

    res.status(status).json({ message });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const port = Number(process.env.PORT || 3001);

  await testConnection();
  console.log(
    `[mysql] Conectado com sucesso em ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}.`,
  );

  await ensureSchema();
  await ensureAuthSeedData();
  await syncJ12TablesFromLegacy();
  await syncEnrollmentNumberRegistry();

  return app.listen(port, () => {
    console.log(`API J12 pronta em http://localhost:${port}`);
  });
}

module.exports = {
  createApp,
  startServer,
};
