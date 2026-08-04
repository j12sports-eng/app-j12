"use strict";

const mysql = require("mysql2/promise");
const { createReadOnlyQueryRunner } = require("./read-only-query-runner");

function parseDatabaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return {};
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    database: url.pathname.replace(/^\/+/, ""),
  };
}

function databaseConfigFromEnv(env = process.env) {
  const urlConfig = parseDatabaseUrl(env.DATABASE_URL);
  return {
    host: env.DB_HOST || urlConfig.host || "localhost",
    port: Number(env.DB_PORT || urlConfig.port || 3306),
    user: env.DB_USER || urlConfig.user,
    password: env.DB_PASSWORD || urlConfig.password,
    database: env.DB_NAME || urlConfig.database,
    ssl: String(env.DB_USE_SSL || env.DB_SSL || "").toLowerCase() === "true" ? {} : undefined,
  };
}

function createDoctorDatabaseClient(config) {
  const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
    multipleStatements: false,
  });
  const reader = createReadOnlyQueryRunner(pool);
  return Object.freeze({
    query: reader.query,
    async close() {
      await pool.end();
    },
  });
}

module.exports = { databaseConfigFromEnv, createDoctorDatabaseClient, parseDatabaseUrl };
