"use strict";

const { buildBaselinePlan } = require("./baseline-manager");
const { executeControlledBaseline } = require("./baseline-write-manager");
const { buildApplyOnePlan, executeApplyOne } = require("./apply-manager");
const { buildRetryFailedPlan, executeRetryFailed } = require("./retry-failed-manager");
const { MigrationManagerUnavailableError, RESERVED_COMMANDS } = require("./constants");
const { buildMigrationPlan } = require("./plan-manager");
const { collectMigrationState } = require("./report-manager");
const { buildValidationReport } = require("./validate-manager");
const { attachOperationalPreflight } = require("./auth-runtime-preflight");

class MigrationManager {
  constructor({
    stateCollector = collectMigrationState,
    operationalPreflightAttacher = attachOperationalPreflight,
  } = {}) {
    this.stateCollector = stateCollector;
    this.operationalPreflightAttacher = operationalPreflightAttacher;
  }

  async collectApplyOneState(context) {
    const state = await this.stateCollector(context);
    return this.operationalPreflightAttacher(state, context, context.migrationId);
  }

  async run(command, context) {
    if (RESERVED_COMMANDS.includes(command)) throw new MigrationManagerUnavailableError(command);
    const state =
      command === "apply-one"
        ? await this.collectApplyOneState(context)
        : await this.stateCollector(context);
    let result;
    if (command === "plan") result = buildMigrationPlan(state);
    else if (command === "apply-one") result = buildApplyOnePlan(state, context.migrationId);
    else if (command === "retry-failed") result = buildRetryFailedPlan(state, context.migrationId);
    else if (command === "baseline") result = buildBaselinePlan(state);
    else if (command === "validate") result = buildValidationReport(state);
    else throw new MigrationManagerUnavailableError(command);
    return {
      ...result,
      source: {
        doctorGeneratedAt: state.doctorReport.generatedAt,
        canonicalRunner: state.runner,
      },
      doctorSummary: state.doctorReport.summary,
    };
  }

  async runBaselineWrite(context) {
    return executeControlledBaseline({
      stateCollector: this.stateCollector,
      writeClientFactory: context.writeClientFactory,
      context,
      onlyIds: context.onlyIds,
      confirmationToken: context.confirmationToken,
      clock: context.clock,
    });
  }

  async runApplyOneWrite(context) {
    return executeApplyOne({
      stateCollector: (writeContext) => this.collectApplyOneState(writeContext),
      writeClientFactory: context.writeClientFactory,
      context,
      migrationId: context.migrationId,
      confirmationToken: context.confirmationToken,
      backupIdentifier: context.backupIdentifier,
      confirmedTables: context.confirmedTables,
      clock: context.clock,
    });
  }

  async runRetryFailedWrite(context) {
    return executeRetryFailed({
      stateCollector: this.stateCollector,
      writeClientFactory: context.writeClientFactory,
      context,
      migrationId: context.migrationId,
      confirmationToken: context.confirmationToken,
      backupIdentifier: context.backupIdentifier,
      clock: context.clock,
    });
  }
}

module.exports = { MigrationManager };
