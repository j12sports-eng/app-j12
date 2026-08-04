"use strict";

const { MigrationManager } = require("./manager");
const {
  evaluateBaselineEligibility,
  evaluateCatalogBaselineEligibility,
} = require("./baseline-eligibility-policy");
const { buildBaselinePlan } = require("./baseline-manager");
const { executeControlledBaseline } = require("./baseline-write-manager");
const { computeBaselineToken } = require("./baseline-token");
const { analyzeDuplicateMigrations } = require("./duplicate-manager");
const { buildMigrationPlan } = require("./plan-manager");
const { buildValidationReport } = require("./validate-manager");
const { buildApplyOnePlan, executeApplyOne } = require("./apply-manager");
const { computeApplyOneToken } = require("./apply-one-token");
const { buildMinimumDraftChain } = require("./draft-chain");
const { evaluateTableOptionAdoption } = require("./baseline-adoption-policy");
const { attachOperationalPreflight } = require("./auth-runtime-preflight");

module.exports = {
  MigrationManager,
  analyzeDuplicateMigrations,
  attachOperationalPreflight,
  buildBaselinePlan,
  buildApplyOnePlan,
  buildMinimumDraftChain,
  buildMigrationPlan,
  buildValidationReport,
  evaluateBaselineEligibility,
  evaluateCatalogBaselineEligibility,
  evaluateTableOptionAdoption,
  executeControlledBaseline,
  executeApplyOne,
  computeBaselineToken,
  computeApplyOneToken,
};
