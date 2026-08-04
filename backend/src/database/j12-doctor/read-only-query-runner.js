"use strict";

const FORBIDDEN_SQL =
  /\b(?:INSERT|UPDATE|DELETE|REPLACE|UPSERT|MERGE|CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE|LOCK|UNLOCK|CALL|DO|SET|USE|LOAD|HANDLER|ANALYZE|OPTIMIZE|REPAIR|FLUSH|RESET|START|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|GET_LOCK|RELEASE_LOCK)\b/i;

class ReadOnlyViolationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReadOnlyViolationError";
  }
}

function stripComments(sql) {
  return String(sql || "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ")
    .replace(/#[^\r\n]*/g, " ")
    .trim();
}

function assertReadOnlySql(sql) {
  const normalized = stripComments(sql);
  if (!/^(?:SELECT|WITH|SHOW|DESCRIBE|DESC|EXPLAIN)\b/i.test(normalized))
    throw new ReadOnlyViolationError("J12 Doctor aceita apenas consultas SQL de leitura.");
  if (FORBIDDEN_SQL.test(normalized))
    throw new ReadOnlyViolationError(
      "A consulta contém uma operação incompatível com o modo somente leitura.",
    );
  if (normalized.split(";").filter((part) => part.trim()).length !== 1)
    throw new ReadOnlyViolationError("Consultas múltiplas são bloqueadas pelo J12 Doctor.");
  return normalized;
}

function createReadOnlyQueryRunner(queryable) {
  if (!queryable || typeof queryable.query !== "function")
    throw new TypeError("Um cliente com query(sql, params) é obrigatório.");
  return Object.freeze({
    async query(sql, params = []) {
      assertReadOnlySql(sql);
      return queryable.query(sql, params);
    },
  });
}

module.exports = { ReadOnlyViolationError, assertReadOnlySql, createReadOnlyQueryRunner };
