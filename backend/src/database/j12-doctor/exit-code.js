"use strict";

const { EXIT_CODES, SEVERITIES } = require("./constants");

function exitCodeForReport(report) {
  if (report.findings.some((item) => item.severity === SEVERITIES.CRITICAL))
    return EXIT_CODES.CRITICAL;
  if (report.findings.some((item) => [SEVERITIES.WARNING, SEVERITIES.HIGH].includes(item.severity)))
    return EXIT_CODES.FINDINGS;
  return EXIT_CODES.CLEAN;
}

module.exports = { exitCodeForReport };
