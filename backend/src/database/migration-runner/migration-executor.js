const { promises: fs } = require("node:fs");

class MigrationExecutor {
  constructor({ query = null, requireModule = require } = {}) {
    this.query = query;
    this.requireModule = requireModule;
  }

  async apply(migration) {
    if (migration.extension === "js") {
      const migrationModule = this.requireModule(migration.path);
      if (typeof migrationModule?.up !== "function")
        throw executorError(
          `JavaScript migration ${migration.id} does not export up().`,
          "MIGRATION_UP_MISSING",
        );
      return migrationModule.up();
    }
    if (migration.extension === "sql") {
      if (typeof this.query !== "function")
        throw new TypeError("SQL migration execution requires a query function.");
      const source = await fs.readFile(migration.path, "utf8");
      const statements = splitSqlStatements(readUpSection(source));
      if (statements.length === 0)
        throw executorError(
          `SQL migration ${migration.id} has no UP statements.`,
          "MIGRATION_UP_EMPTY",
        );
      for (const statement of statements) await this.query(statement);
      return;
    }
    throw executorError(
      `Unsupported migration extension: ${migration.extension}.`,
      "MIGRATION_EXTENSION_UNSUPPORTED",
    );
  }
}

function readUpSection(source) {
  const upMarker = /^\s*--\s*UP\s*$/im;
  const downMarker = /^\s*--\s*DOWN\s*$/im;
  const upMatch = upMarker.exec(source);
  if (!upMatch)
    throw executorError("SQL migration requires a -- UP section.", "MIGRATION_UP_MARKER_MISSING");
  const remaining = source.slice(upMatch.index + upMatch[0].length);
  const downMatch = downMarker.exec(remaining);
  return downMatch ? remaining.slice(0, downMatch.index) : remaining;
}

function splitSqlStatements(source) {
  const statements = [];
  let current = "";
  let quote = null;
  let lineComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
        current += character;
      }
      continue;
    }
    if (!quote && character === "-" && next === "-") {
      lineComment = true;
      index += 1;
      continue;
    }
    if ((character === "'" || character === '"' || character === "`") && source[index - 1] !== "\\")
      quote = quote === character ? null : quote || character;
    if (character === ";" && !quote) {
      if (current.trim()) statements.push(current.trim());
      current = "";
    } else current += character;
  }
  if (quote)
    throw executorError("SQL migration contains an unterminated quote.", "MIGRATION_SQL_INVALID");
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function executorError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

module.exports = { MigrationExecutor, executorError, readUpSection, splitSqlStatements };
