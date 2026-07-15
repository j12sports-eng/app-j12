const { randomUUID } = require("node:crypto");

const {
  FinancialAutomationHistoryService,
} = require("../domains/financeiro/application/history/index.js");
const {
  MySqlAutomationExecutionHistoryRepository,
} = require("../domains/financeiro/infrastructure/repositories/index.js");

function createMonthlyBillingHistoryService(options = {}) {
  const repository =
    options.historyRepository ||
    new MySqlAutomationExecutionHistoryRepository({ queryRunner: options.queryRunner || null });
  return options.historyService || new FinancialAutomationHistoryService({ repository });
}

async function generateCanonicalMonthlyBilling(options = {}) {
  const {
    generateMonthlyCharges,
    syncAllChargeCompatibilityTables,
  } = require("../../services/student-finance.js");
  const summary = await generateMonthlyCharges({
    actorName: options.requestedBy || "admin",
    referenceCompetencia: options.competencia,
  });

  // Important: keep compatibility projections aligned only after the canonical
  // charge transaction succeeds, following the existing Financeiro flow.
  await syncAllChargeCompatibilityTables();
  return normalizeMonthlyBillingSummary(summary, options.competencia);
}

async function executeMonthlyBillingAutomation(options = {}) {
  const historyService = createMonthlyBillingHistoryService(options);
  const generate = options.generate || generateCanonicalMonthlyBilling;
  const startedAt = new Date().toISOString();
  const executionId =
    options.executionId || `billing-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const common = {
    automationName: "monthly-billing",
    workflowName: "financeiro-gerar-mensalidades",
    triggerType: "ADMIN_UI",
    startedAt,
    executionId,
    correlationId: options.correlationId || executionId,
    input: { competencia: options.competencia || null },
    metadata: {
      environment: process.env.J12_ENVIRONMENT || process.env.NODE_ENV || "unknown",
      localOnly: process.env.J12_ENVIRONMENT === "e2e-local",
      requestedBy: options.requestedBy || "admin",
    },
  };

  // Important: the append-only STARTED entry proves that the UI action reached the workflow.
  await historyService.recordStarted(common);

  let summary;
  try {
    summary = normalizeMonthlyBillingSummary(
      await generate({
        competencia: options.competencia,
        requestedBy: common.metadata.requestedBy,
      }),
      options.competencia,
    );
  } catch (error) {
    try {
      await historyService.recordFailed({ ...common, error });
    } catch (historyError) {
      // Preserve the business failure as the primary error if the audit store
      // independently fails while recording it.
      error.historyPersistenceError = {
        code: historyError?.code || "AUTOMATION_HISTORY_WRITE_FAILED",
        message: historyError?.message || "Automation history write failed.",
      };
    }
    throw error;
  }

  // A completion-write failure must not mislabel finished billing as FAILED.
  await historyService.recordSucceeded({ ...common, output: summary });
  return { executionId, summary };
}

function normalizeMonthlyBillingSummary(value = {}, fallbackCompetencia) {
  const created = safeCount(value.createdCount ?? value.created ?? value.criadas ?? value.geradas);
  const skipped = safeCount(
    value.skippedCount ?? value.skipped ?? value.ignoradas ?? value.existentes,
  );

  return {
    ...value,
    competencia: value.competencia || fallbackCompetencia || null,
    created,
    skipped,
    createdCount: created,
    skippedCount: skipped,
    criadas: created,
    geradas: created,
    ignoradas: skipped,
    existentes: safeCount(value.existentes, skipped),
    erros: Array.isArray(value.erros) ? value.erros : [],
    total_alunos: safeCount(value.total_alunos, created + skipped),
  };
}

function safeCount(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

module.exports = {
  createMonthlyBillingHistoryService,
  executeMonthlyBillingAutomation,
  generateCanonicalMonthlyBilling,
  normalizeMonthlyBillingSummary,
};
