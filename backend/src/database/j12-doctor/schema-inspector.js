"use strict";

function rowsOf(result) {
  return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
}

async function inspectSchema(reader, databaseName) {
  const [tableResult, columnResult, indexResult, foreignKeyResult] = await Promise.all([
    reader.query(
      `SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, ROW_FORMAT, CREATE_OPTIONS
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME`,
      [databaseName],
    ),
    reader.query(
      `SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_DEFAULT,
        IS_NULLABLE, DATA_TYPE, COLUMN_TYPE, COLUMN_KEY, EXTRA, GENERATION_EXPRESSION,
        CHARACTER_SET_NAME, COLLATION_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [databaseName],
    ),
    reader.query(
      `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME,
        COLLATION, SUB_PART, INDEX_TYPE
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
      [databaseName],
    ),
    reader.query(
      `SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, k.ORDINAL_POSITION,
        k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
        r.UPDATE_RULE, r.DELETE_RULE
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
      LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r
        ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
       AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
       AND r.TABLE_NAME = k.TABLE_NAME
      WHERE k.CONSTRAINT_SCHEMA = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
      [databaseName],
    ),
  ]);

  const tables = {};
  for (const row of rowsOf(tableResult)) {
    const collation = row.TABLE_COLLATION || null;
    tables[row.TABLE_NAME] = {
      name: row.TABLE_NAME,
      engine: row.ENGINE || null,
      charset: collation ? collation.split("_")[0] : null,
      collation,
      rowFormat: row.ROW_FORMAT || null,
      createOptions: row.CREATE_OPTIONS || null,
      columns: {},
      indexes: {},
      foreignKeys: {},
    };
  }
  for (const row of rowsOf(columnResult)) {
    const table = tables[row.TABLE_NAME];
    if (!table) continue;
    table.columns[row.COLUMN_NAME] = {
      name: row.COLUMN_NAME,
      position: Number(row.ORDINAL_POSITION),
      dataType: String(row.DATA_TYPE || "").toLowerCase(),
      columnType: String(row.COLUMN_TYPE || "").toLowerCase(),
      nullable: row.IS_NULLABLE === "YES",
      default: row.COLUMN_DEFAULT === undefined ? null : row.COLUMN_DEFAULT,
      primary: row.COLUMN_KEY === "PRI",
      generated: Boolean(row.GENERATION_EXPRESSION),
      generationExpression: row.GENERATION_EXPRESSION || null,
      autoIncrement: String(row.EXTRA || "")
        .toLowerCase()
        .includes("auto_increment"),
      extra: row.EXTRA || "",
      charset: row.CHARACTER_SET_NAME || null,
      collation: row.COLLATION_NAME || null,
    };
  }
  for (const row of rowsOf(indexResult)) {
    const table = tables[row.TABLE_NAME];
    if (!table) continue;
    const index = table.indexes[row.INDEX_NAME] || {
      name: row.INDEX_NAME,
      unique: Number(row.NON_UNIQUE) === 0,
      primary: row.INDEX_NAME === "PRIMARY",
      type: row.INDEX_TYPE || null,
      columns: [],
    };
    index.columns.push({
      name: row.COLUMN_NAME || null,
      expression: null,
      prefixLength: row.SUB_PART == null ? null : Number(row.SUB_PART),
      order: row.COLLATION || null,
    });
    table.indexes[row.INDEX_NAME] = index;
  }
  for (const row of rowsOf(foreignKeyResult)) {
    const table = tables[row.TABLE_NAME];
    if (!table) continue;
    const foreignKey = table.foreignKeys[row.CONSTRAINT_NAME] || {
      name: row.CONSTRAINT_NAME,
      columns: [],
      referencedTable: row.REFERENCED_TABLE_NAME,
      referencedColumns: [],
      updateRule: row.UPDATE_RULE || null,
      deleteRule: row.DELETE_RULE || null,
    };
    foreignKey.columns.push(row.COLUMN_NAME);
    foreignKey.referencedColumns.push(row.REFERENCED_COLUMN_NAME);
    table.foreignKeys[row.CONSTRAINT_NAME] = foreignKey;
  }
  return {
    database: databaseName,
    tables,
    counts: {
      tables: Object.keys(tables).length,
      columns: rowsOf(columnResult).length,
      indexes: Object.values(tables).reduce(
        (total, table) => total + Object.keys(table.indexes).length,
        0,
      ),
      foreignKeys: Object.values(tables).reduce(
        (total, table) => total + Object.keys(table.foreignKeys).length,
        0,
      ),
    },
  };
}

module.exports = { inspectSchema, rowsOf };
