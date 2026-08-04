"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { assessLedger } = require("../checks/migration-ledger-check");
const { EXIT_CODES, LEDGER_STATES, SEVERITIES } = require("../constants");
const { main, parseArgs } = require("../cli");

const migration = {
  id: "20260101000000_example",
  timestamp: "20260101000000",
  name: "example",
  checksum: "abc",
  dependencies: [],
  fileName: "20260101000000_example.sql",
};

test("mantém estado formal separado e acusa checksum divergente", () => {
  const assessment = assessLedger([migration], {
    exists: true,
    rows: [{ id: migration.id, checksum: "different", status: "APPLIED", appliedAt: null }],
  });
  assert.equal(assessment.migrations[0].ledgerState, LEDGER_STATES.APPLIED);
  assert.equal(assessment.findings[0].severity, SEVERITIES.CRITICAL);
});

test("parser cobre os cinco comandos e rejeita argumentos desconhecidos", () => {
  for (const command of ["inspect", "report", "check-migrations", "check-schema", "check-drift"])
    assert.equal(parseArgs([command, "--confirm-database=j12"]).command, command);
  assert.throws(() => parseArgs(["inspect", "--write"]), /Argumento desconhecido/);
});

test("CLI valida alvo antes de criar cliente", async () => {
  let created = false;
  let errorText = "";
  const code = await main(["inspect"], {
    env: { DB_HOST: "localhost", DB_NAME: "j12" },
    createClient() {
      created = true;
      throw new Error("não deveria conectar");
    },
    output: { write() {} },
    errorOutput: {
      write(value) {
        errorText += value;
      },
    },
  });
  assert.equal(code, EXIT_CODES.USAGE);
  assert.equal(created, false);
  assert.match(errorText, /--confirm-database=j12/);
});

test("CLI usa fakes, fecha cliente e retorna severidade do relatório", async () => {
  let closed = false;
  let outputText = "";
  const fakeReport = {
    database: { name: "j12" },
    summary: { applied: 0, pending: 0, drifted: 0, findings: 1, tables: 0 },
    schema: { counts: { tables: 0, columns: 0, indexes: 0, foreignKeys: 0 } },
    migrations: [],
    findings: [{ code: "WARN", severity: "WARNING", message: "aviso", details: {} }],
    recommendations: [],
  };
  const code = await main(["report", "--confirm-database=j12"], {
    env: { DB_HOST: "localhost", DB_NAME: "j12" },
    createClient() {
      return {
        query() {},
        async close() {
          closed = true;
        },
      };
    },
    async executeDoctor() {
      return fakeReport;
    },
    output: {
      write(value) {
        outputText += value;
      },
    },
    errorOutput: { write() {} },
  });
  assert.equal(code, EXIT_CODES.FINDINGS);
  assert.equal(closed, true);
  assert.equal(JSON.parse(outputText).database.name, "j12");
});
