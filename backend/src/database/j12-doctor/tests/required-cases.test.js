"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { assessManifest } = require("../checks/schema-manifest-check");
const { EXIT_CODES, LEDGER_STATES, PHYSICAL_STATES, SEVERITIES } = require("../constants");
const { summarize } = require("../doctor");
const { exitCodeForReport } = require("../exit-code");

const manifest = {
  migrationId: "critical",
  tables: [
    {
      name: "enrollments",
      columns: { id: { columnType: "varchar(64)", nullable: false } },
      indexes: { ux_sample: { columns: ["id"], unique: true } },
      foreignKeys: {
        fk_sample: { columns: ["id"], referencedTable: "people", referencedColumns: ["id"] },
      },
    },
  ],
};

function tableSnapshot() {
  return {
    database: "j12",
    counts: {},
    tables: {
      enrollments: {
        columns: { id: { columnType: "varchar(64)", nullable: false } },
        indexes: { ux_sample: { columns: [{ name: "id" }], unique: true } },
        foreignKeys: {
          fk_sample: { columns: ["id"], referencedTable: "people", referencedColumns: ["id"] },
        },
      },
    },
  };
}

test("detecta tabela crítica ausente", () => {
  const result = assessManifest({ database: "j12", counts: {}, tables: {} }, manifest);
  assert.equal(result.physicalState, PHYSICAL_STATES.ABSENT);
  assert.equal(result.findings[0].code, "TABLE_MISSING");
  assert.equal(result.findings[0].severity, SEVERITIES.CRITICAL);
});

test("detecta composição divergente de índice", () => {
  const snapshot = tableSnapshot();
  snapshot.tables.enrollments.indexes.ux_sample.columns = [{ name: "other" }];
  const result = assessManifest(snapshot, manifest);
  assert.equal(result.physicalState, PHYSICAL_STATES.INCOMPATIBLE);
  assert.ok(result.findings.some((item) => item.code === "INDEX_MISMATCH"));
});

test("detecta FK ausente", () => {
  const snapshot = tableSnapshot();
  delete snapshot.tables.enrollments.foreignKeys.fk_sample;
  const result = assessManifest(snapshot, manifest);
  assert.equal(result.physicalState, PHYSICAL_STATES.PARTIAL);
  assert.ok(result.findings.some((item) => item.code === "FOREIGN_KEY_MISSING"));
});

test("gera resumo formal e físico com as classificações públicas", () => {
  const report = {
    findings: [{ severity: SEVERITIES.WARNING }],
    migrations: [
      {
        ledgerState: LEDGER_STATES.APPLIED,
        physicalState: PHYSICAL_STATES.PRESENT,
        driftDetected: false,
      },
      {
        ledgerState: LEDGER_STATES.PENDING,
        physicalState: PHYSICAL_STATES.PARTIAL,
        driftDetected: true,
      },
      {
        ledgerState: LEDGER_STATES.PENDING,
        physicalState: PHYSICAL_STATES.ABSENT,
        driftDetected: false,
      },
      {
        ledgerState: LEDGER_STATES.PENDING,
        physicalState: PHYSICAL_STATES.NOT_ASSESSED,
        driftDetected: false,
      },
    ],
  };
  const summary = summarize(report);
  assert.deepEqual(
    {
      total: summary.migrationsTotal,
      applied: summary.ledgerApplied,
      pending: summary.ledgerPending,
      present: summary.physicallyPresent,
      partial: summary.partiallyPresent,
      absent: summary.physicallyAbsent,
      drift: summary.driftDetected,
      unknown: summary.unknown,
    },
    { total: 4, applied: 1, pending: 3, present: 1, partial: 1, absent: 1, drift: 1, unknown: 1 },
  );
});

test("mapeia exit codes limpo, warning e crítico", () => {
  assert.equal(exitCodeForReport({ findings: [] }), EXIT_CODES.CLEAN);
  assert.equal(
    exitCodeForReport({ findings: [{ severity: SEVERITIES.WARNING }] }),
    EXIT_CODES.FINDINGS,
  );
  assert.equal(
    exitCodeForReport({ findings: [{ severity: SEVERITIES.CRITICAL }] }),
    EXIT_CODES.CRITICAL,
  );
});
