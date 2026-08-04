"use strict";

class DoctorUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "DoctorUsageError";
  }
}

function isLocalHost(host) {
  return ["localhost", "127.0.0.1", "::1"].includes(
    String(host || "")
      .trim()
      .toLowerCase(),
  );
}

function assertDatabaseTarget({
  configuredDatabase,
  configuredHost,
  confirmDatabase,
  allowRemote,
}) {
  if (!configuredDatabase)
    throw new DoctorUsageError("DB_NAME deve identificar explicitamente o banco alvo.");
  if (!confirmDatabase || confirmDatabase !== configuredDatabase) {
    throw new DoctorUsageError(
      `Confirme o banco exatamente com --confirm-database=${configuredDatabase}.`,
    );
  }
  if (!isLocalHost(configuredHost) && !allowRemote) {
    throw new DoctorUsageError(
      "Banco remoto bloqueado. Use também --allow-remote após confirmar o nome exato do banco.",
    );
  }
}

module.exports = { DoctorUsageError, assertDatabaseTarget, isLocalHost };
