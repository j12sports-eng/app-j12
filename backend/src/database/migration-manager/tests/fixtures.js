"use strict";

const { LEDGER_STATES, PHYSICAL_STATES, SEVERITIES } = require("../../j12-doctor/constants");

function migration(overrides) {
  return {
    id: "20260101000000_default",
    name: "default",
    fileName: "20260101000000_default.sql",
    checksum: "a".repeat(64),
    dependencies: [],
    ledgerState: LEDGER_STATES.PENDING,
    ledgerStatus: null,
    checksumMatches: null,
    physicalState: PHYSICAL_STATES.ABSENT,
    driftDetected: false,
    manifestAvailable: true,
    ...overrides,
  };
}

function doctorReport() {
  const migrations = [
    migration({
      id: "20260101000000_people",
      name: "people",
      fileName: "20260101000000_people.sql",
      physicalState: PHYSICAL_STATES.PRESENT,
      driftDetected: true,
    }),
    migration({
      id: "20260102000000_enrollments",
      name: "enrollments",
      fileName: "20260102000000_enrollments.sql",
      dependencies: ["20260101000000_people"],
      physicalState: PHYSICAL_STATES.PRESENT,
      driftDetected: true,
    }),
    migration({
      id: "20260103000000_documents",
      name: "documents",
      fileName: "20260103000000_documents.sql",
      dependencies: ["20260102000000_enrollments"],
      physicalState: PHYSICAL_STATES.PARTIAL,
      driftDetected: true,
    }),
    migration({
      id: "20260104000000_unknown",
      name: "unknown",
      fileName: "20260104000000_unknown.js",
      physicalState: PHYSICAL_STATES.NOT_ASSESSED,
      manifestAvailable: false,
    }),
    migration({
      id: "20260105000000_absent",
      name: "absent",
      fileName: "20260105000000_absent.sql",
    }),
  ];
  return {
    generatedAt: "2026-08-03T12:00:00.000Z",
    database: { host: "localhost", name: "j12", remote: false },
    schemaSnapshot: { tables: {} },
    summary: {
      ledgerApplied: 0,
      ledgerPending: 5,
      physicallyPresent: 2,
      partiallyPresent: 1,
      physicallyAbsent: 1,
      unknown: 1,
      severityCounts: { INFO: 0, WARNING: 1, HIGH: 1, CRITICAL: 1 },
    },
    migrations,
    findings: [
      {
        code: "MIGRATION_LEDGER_MISSING",
        severity: SEVERITIES.CRITICAL,
        message: "ledger missing",
        details: {},
      },
      {
        code: "COLUMN_MISSING",
        severity: SEVERITIES.HIGH,
        message: "column missing",
        details: {},
      },
    ],
  };
}

function canonicalPlan(report = doctorReport()) {
  return report.migrations.map((item) => ({
    id: item.id,
    fileName: item.fileName,
    checksum: item.checksum,
    dependencies: item.dependencies,
    state: "PENDING",
  }));
}

module.exports = { canonicalPlan, doctorReport, migration };
