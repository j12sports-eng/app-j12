const TABLE_NAME = "enrollment_financial_bridges";
const MYSQL_DUPLICATE_ENTRY_CODE = "ER_DUP_ENTRY";
const BRIDGE_COLUMNS =
  "obligation_id, charge_id, installment_id, legacy_student_id, enrollment_id, status, created_by, created_at, updated_at";

const INSERT_BRIDGE_SQL = `
  INSERT INTO ${TABLE_NAME} (
    obligation_id, charge_id, installment_id, legacy_student_id,
    enrollment_id, status, created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`;
const SELECT_BY_OBLIGATION_SQL = `SELECT ${BRIDGE_COLUMNS} FROM ${TABLE_NAME} WHERE obligation_id = ? LIMIT 1`;
const SELECT_BY_CHARGE_SQL = `SELECT ${BRIDGE_COLUMNS} FROM ${TABLE_NAME} WHERE charge_id = ? LIMIT 1`;
const SELECT_BY_INSTALLMENT_SQL = `SELECT ${BRIDGE_COLUMNS} FROM ${TABLE_NAME} WHERE installment_id = ? LIMIT 1`;

class MySqlEnrollmentFinancialBridgeRepository {
  constructor({ transactionRunner = null } = {}) {
    this.transactionRunner = transactionRunner || getDefaultTransactionRunner();
  }

  async createBridge(input = {}) {
    const values = normalizeCreateInput(input);

    return this.runInTransaction(async (query) => {
      try {
        await query(INSERT_BRIDGE_SQL, [
          values.obligationId,
          values.chargeId,
          values.installmentId,
          values.legacyStudentId,
          values.enrollmentId,
          values.status,
          values.createdBy,
        ]);
      } catch (error) {
        if (!isDuplicateEntryError(error)) throw error;

        const existing = await findOne(query, SELECT_BY_OBLIGATION_SQL, values.obligationId);
        if (existing && bridgeMatches(existing, values)) {
          return { bridge: existing, created: false, reused: true };
        }

        const conflict = new Error("Financial bridge conflicts with an existing unique identity.");
        conflict.code = "ENROLLMENT_FINANCIAL_BRIDGE_DUPLICATE";
        conflict.cause = error;
        throw conflict;
      }

      return {
        bridge: await findOne(query, SELECT_BY_OBLIGATION_SQL, values.obligationId),
        created: true,
        reused: false,
      };
    });
  }

  async findByObligationId(obligationId) {
    return this.findBy(SELECT_BY_OBLIGATION_SQL, obligationId, "obligationId");
  }

  async findByChargeId(chargeId) {
    return this.findBy(SELECT_BY_CHARGE_SQL, chargeId, "chargeId");
  }

  async findByInstallmentId(installmentId) {
    return this.findBy(SELECT_BY_INSTALLMENT_SQL, installmentId, "installmentId");
  }

  async findBy(sql, id, field) {
    const normalizedId = requiredText(id, field, 64);
    return this.runInTransaction((query) => findOne(query, sql, normalizedId));
  }

  async runInTransaction(work) {
    if (typeof this.transactionRunner !== "function") {
      throw new TypeError("Financial bridge repository requires a transaction runner.");
    }

    return this.transactionRunner(async (connection) => {
      const query = createConnectionQuery(connection);
      return work(query);
    });
  }
}

function createConnectionQuery(connection) {
  if (!connection || typeof connection.execute !== "function") {
    throw new TypeError("Financial bridge transaction requires connection.execute().");
  }

  return async (sql, params = []) => {
    const [rows] = await connection.execute(sql, params);
    return rows;
  };
}

async function findOne(query, sql, id) {
  const rows = await query(sql, [id]);
  return mapBridge(Array.isArray(rows) ? rows[0] : null);
}

function normalizeCreateInput(input) {
  return {
    chargeId: requiredText(input.chargeId, "chargeId", 64),
    createdBy: requiredText(input.createdBy, "createdBy", 191),
    enrollmentId: requiredText(input.enrollmentId, "enrollmentId", 64),
    installmentId: requiredText(input.installmentId, "installmentId", 64),
    legacyStudentId: requiredText(input.legacyStudentId, "legacyStudentId", 64),
    obligationId: requiredText(input.obligationId, "obligationId", 64),
    status: requiredText(input.status || "LINKED", "status", 32).toUpperCase(),
  };
}

function mapBridge(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;

  return {
    chargeId: row.charge_id ?? null,
    createdAt: row.created_at ?? null,
    createdBy: row.created_by ?? null,
    enrollmentId: row.enrollment_id ?? null,
    installmentId: row.installment_id ?? null,
    legacyStudentId: row.legacy_student_id ?? null,
    obligationId: row.obligation_id ?? null,
    status: row.status ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function bridgeMatches(bridge, values) {
  return (
    bridge.obligationId === values.obligationId &&
    bridge.chargeId === values.chargeId &&
    bridge.installmentId === values.installmentId &&
    bridge.legacyStudentId === values.legacyStudentId &&
    bridge.enrollmentId === values.enrollmentId
  );
}

function isDuplicateEntryError(error) {
  return String(error?.code || "") === MYSQL_DUPLICATE_ENTRY_CODE || Number(error?.errno) === 1062;
}

function requiredText(value, field, max) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  if (!normalized) {
    throw new TypeError(`Financial bridge repository requires ${field}.`);
  }
  return normalized;
}

function getDefaultTransactionRunner() {
  return require("../../../../config/db.js").transaction;
}

module.exports = {
  INSERT_BRIDGE_SQL,
  MySqlEnrollmentFinancialBridgeRepository,
  SELECT_BY_CHARGE_SQL,
  SELECT_BY_INSTALLMENT_SQL,
  SELECT_BY_OBLIGATION_SQL,
  TABLE_NAME,
  bridgeMatches,
  createConnectionQuery,
  isDuplicateEntryError,
  mapBridge,
};
