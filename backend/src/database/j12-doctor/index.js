"use strict";

const { runDoctor } = require("./doctor");
const { inspectSchema } = require("./schema-inspector");
const { assertDatabaseTarget } = require("./database-target-guard");
const { assertReadOnlySql, createReadOnlyQueryRunner } = require("./read-only-query-runner");

module.exports = {
  assertDatabaseTarget,
  assertReadOnlySql,
  createReadOnlyQueryRunner,
  inspectSchema,
  runDoctor,
};
