#!/usr/bin/env node

const {
  PreEnrollmentIntegrityAuditService,
} = require("../../domains/pessoas/pre-enrollment-integrity-audit.js");

async function run() {
  const database = require("../../config/db.js");
  try {
    const report = await new PreEnrollmentIntegrityAuditService().audit(database.query);
    console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    if (database.pool && typeof database.pool.end === "function") await database.pool.end();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(
      JSON.stringify({ code: error.code || "INTEGRITY_AUDIT_FAILED", message: error.message }),
    );
    process.exitCode = 1;
  });
}

module.exports = { run };
