#!/usr/bin/env node
const { randomBytes } = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const mysql = require("mysql2/promise");

const { assertSprint2311Environment } = require("./sprint-23-11-environment.cjs");

const ROOT = path.resolve(__dirname, "../..");
const ARTIFACTS = path.join(ROOT, "artifacts/e2e");
// Keep the failed pre-remediation datadir immutable as audit evidence.
const DATADIR = path.join(ARTIFACTS, "mysql-data-sprint-23-11a-3");
const MYSQLD =
  process.env.E2E_MYSQLD_PATH || "C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqld.exe";
const processes = [];

function buildEnvironment() {
  const secret = randomBytes(24).toString("base64url");
  return {
    ...process.env,
    J12_ENVIRONMENT: "e2e-local",
    HML_ISOLATED: "true",
    HML_REAL_INTEGRATIONS_ENABLED: "false",
    NODE_ENV: "development",
    HOST: "127.0.0.1",
    PORT: "3101",
    DB_HOST: "127.0.0.1",
    DB_PORT: "3307",
    DB_NAME: "j12_e2e_hml",
    DB_USER: "j12_e2e",
    DB_PASSWORD: `LocalOnly-${secret}`,
    DB_USE_SSL: "false",
    DATABASE_URL: "",
    JWT_SECRET: `LocalOnlyJwt-${randomBytes(32).toString("base64url")}`,
    E2E_BASE_URL: "http://127.0.0.1:3000",
    E2E_API_URL: "http://127.0.0.1:3101",
    VITE_API_URL: "http://127.0.0.1:3101",
    CORS_ORIGIN: "http://127.0.0.1:3000",
    AUTH_SEED_ENABLED: "true",
    AUTH_SEED_ADMIN_PASSWORD: `LocalE2e1!${secret}`,
    AUTH_SEED_COORDENADOR_PASSWORD: `LocalE2e1!${secret}`,
    AUTH_SEED_PROFESSOR_PASSWORD: `LocalE2e1!${secret}`,
    AUTH_SEED_ALUNO_PASSWORD: `LocalE2e1!${secret}`,
    AUTH_SEED_RESPONSAVEL_PASSWORD: `LocalE2e1!${secret}`,
    E2E_AUTH_PASSWORD: `LocalE2e1!${secret}`,
    EMAIL_PROVIDER: "disabled",
    INTER_INTEGRATION_MODE: "disabled",
    RATE_LIMIT_MAX: "5000",
    BOOTSTRAP_WARN_TIMEOUT_MS: "60000",
    INTER_CLIENT_ID: "",
    INTER_CLIENT_SECRET: "",
    INTER_PIX_KEY: "",
    INTER_PIX_CHAVE: "",
    INTER_CERT_PATH: "",
    INTER_KEY_PATH: "",
    N8N_BASE_URL: "",
    N8N_WEBHOOK_URL: "",
    N8N_SERVICE_TOKEN: "",
    RESEND_API_KEY: "",
    RESEND_FROM_EMAIL: "",
    BOTCONVERSA_WEBHOOK_URL: "",
    BOTCONVERSA_API_URL: "",
    BOTCONVERSA_API_KEY: "",
    BOTCONVERSA_TOKEN: "",
  };
}

async function main() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const env = buildEnvironment();
  const guard = assertSprint2311Environment(env);
  writeJson("preflight.json", { checkedAt: new Date().toISOString(), ...guard.identity });
  assertMysqlBinary();
  await assertPortFree(3307);

  const plan = await runCapture(
    process.execPath,
    ["backend/src/database/migration-runner/cli.js", "up", "--dry-run"],
    env,
  );
  fs.writeFileSync(path.join(ARTIFACTS, "migration-plan.json"), plan.stdout);
  if (plan.code !== 0) throw new Error(`Migration dry-run failed: ${plan.stderr}`);
  await initializeDatadir(env);

  const mysqld = start(
    MYSQLD,
    [
      "--no-defaults",
      `--datadir=${DATADIR}`,
      "--port=3307",
      "--bind-address=127.0.0.1",
      "--mysqlx=0",
      `--pid-file=${path.join(ARTIFACTS, "mysql-e2e.pid")}`,
    ],
    env,
    "mysql-runtime",
  );
  await waitForPort(3307, 60_000);

  const root = await mysql.createConnection({
    host: "localhost",
    port: 3307,
    user: "root",
    password: "",
  });
  try {
    await provisionUser(root, env);
    await writeDatabaseInventory(root, "database-inventory-before.json", false);
    if (process.argv.includes("--apply-local-migrations")) {
      const applied = await runCapture(
        process.execPath,
        ["backend/src/database/migration-runner/cli.js", "up", "--confirm-database=j12_e2e_hml"],
        env,
      );
      fs.writeFileSync(path.join(ARTIFACTS, "migration-apply.stdout.log"), applied.stdout);
      fs.writeFileSync(path.join(ARTIFACTS, "migration-apply.stderr.log"), applied.stderr);
      if (applied.code !== 0) throw new Error(`Migration apply failed: ${applied.stderr}`);
      await writeDatabaseInventory(root, "database-inventory-after.json", true);
    }
  } finally {
    await root.end();
  }

  if (
    process.argv.includes("--inspect-only") ||
    !process.argv.includes("--apply-local-migrations")
  ) {
    await stopMysql(mysqld);
    process.stdout.write("Sprint 23.11 isolated database inspection completed.\n");
    return;
  }

  start(process.execPath, ["backend/server.js"], env, "api-runtime");
  await waitForHttp("http://127.0.0.1:3101/ready", 90_000);
  start(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "3000"],
    env,
    "frontend-runtime",
  );
  await waitForHttp("http://127.0.0.1:3000/login", 90_000);

  const result = await runCapture(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", "--config=playwright.config.cjs"],
    env,
  );
  fs.writeFileSync(path.join(ARTIFACTS, "playwright.stdout.log"), result.stdout);
  fs.writeFileSync(path.join(ARTIFACTS, "playwright.stderr.log"), result.stderr);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.code !== 0) process.exitCode = result.code;
}

function assertMysqlBinary() {
  if (!fs.existsSync(MYSQLD)) throw new Error(`MySQL binary missing: ${MYSQLD}`);
}

async function initializeDatadir(env) {
  if (fs.existsSync(path.join(DATADIR, "auto.cnf"))) return;
  fs.mkdirSync(DATADIR, { recursive: true });
  const initialized = await runCapture(
    MYSQLD,
    ["--no-defaults", "--initialize-insecure", `--datadir=${DATADIR}`, "--console"],
    env,
  );
  fs.writeFileSync(path.join(ARTIFACTS, "mysql-initialize.stdout.log"), initialized.stdout);
  fs.writeFileSync(path.join(ARTIFACTS, "mysql-initialize.stderr.log"), initialized.stderr);
  if (initialized.code !== 0) {
    throw new Error(`Disposable MySQL initialization failed: ${initialized.stderr}`);
  }
}

async function provisionUser(root, env) {
  await root.query(
    "CREATE DATABASE IF NOT EXISTS j12_e2e_hml CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
  );
  const password = root.escape(env.DB_PASSWORD);
  for (const host of ["127.0.0.1", "localhost"]) {
    await root.query(`CREATE USER IF NOT EXISTS 'j12_e2e'@'${host}' IDENTIFIED BY ${password}`);
    await root.query(`ALTER USER 'j12_e2e'@'${host}' IDENTIFIED BY ${password}`);
    await root.query(`GRANT ALL PRIVILEGES ON j12_e2e_hml.* TO 'j12_e2e'@'${host}'`);
  }
}

async function writeDatabaseInventory(connection, fileName, migrationsApplied) {
  const [[identity]] = await connection.query(
    "SELECT @@hostname AS hostname, @@port AS port, @@version AS version",
  );
  const [schemas] = await connection.query(
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'j12_e2e_hml'",
  );
  const [tables] = await connection.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'j12_e2e_hml' ORDER BY table_name",
  );
  const ledger = tables.some((row) => row.TABLE_NAME === "j12_schema_migrations");
  const [ledgerRecords] = ledger
    ? await connection.query(
        "SELECT id, status, checksum FROM j12_e2e_hml.j12_schema_migrations ORDER BY applied_at, id",
      )
    : [[]];
  const [foreignKeys] = await connection.query(
    `SELECT table_name, constraint_name, referenced_table_name
     FROM information_schema.key_column_usage
     WHERE table_schema = 'j12_e2e_hml' AND referenced_table_name IS NOT NULL
     ORDER BY table_name, constraint_name`,
  );
  writeJson(fileName, {
    inspectedAt: new Date().toISOString(),
    identity,
    schemaPresent: schemas.length === 1,
    tableCount: tables.length,
    tables: tables.map((row) => row.TABLE_NAME),
    migrationLedgerPresent: ledger,
    migrationLedger: {
      applied: ledgerRecords.filter((row) => row.status === "APPLIED").length,
      applying: ledgerRecords.filter((row) => row.status === "APPLYING").length,
      failed: ledgerRecords.filter((row) => row.status === "FAILED").length,
      records: ledgerRecords,
    },
    foreignKeys,
    migrationsApplied,
  });
}

function start(command, args, env, logName) {
  const stdout = fs.openSync(path.join(ARTIFACTS, `${logName}.stdout.log`), "a");
  const stderr = fs.openSync(path.join(ARTIFACTS, `${logName}.stderr.log`), "a");
  const child = spawn(command, args, { cwd: ROOT, env, stdio: ["ignore", stdout, stderr] });
  child.j12Name = logName;
  processes.push(child);
  child.once("exit", () => {
    fs.closeSync(stdout);
    fs.closeSync(stderr);
  });
  return child;
}

function runCapture(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

async function waitForHttp(url, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function waitForPort(port, timeout) {
  const deadline = Date.now() + timeout;
  return new Promise((resolve, reject) => {
    const probe = () => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) reject(new Error(`Timed out waiting for port ${port}`));
        else setTimeout(probe, 300);
      });
    };
    probe();
  });
}

async function assertPortFree(port) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => server.close(resolve));
}

async function stopMysql(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(10_000)]);
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(ARTIFACTS, name), `${JSON.stringify(value, null, 2)}\n`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanup() {
  for (const child of [...processes].reverse()) {
    if (child.exitCode === null && child.j12Name !== "mysql-runtime") stopChild(child);
  }
  await delay(750);
  const mysqlChild = processes.find((child) => child.j12Name === "mysql-runtime");
  if (mysqlChild?.exitCode === null) {
    try {
      const connection = await mysql.createConnection({
        host: "localhost",
        port: 3307,
        user: "root",
        password: "",
      });
      await connection.query("SHUTDOWN");
    } catch {
      stopChild(mysqlChild);
    }
  }
  await delay(750);
}

function stopChild(child) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

main()
  .catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  })
  .finally(cleanup);
