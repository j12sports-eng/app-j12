const { ScenarioDefinition } = require("./ScenarioDefinition.js");

const WORKFLOW = "financeiro-cobranca-diaria";

function scenario(id, name, description, simulation, expectedResult, workflow = WORKFLOW) {
  return new ScenarioDefinition({
    description,
    expectedResult,
    id,
    mode: "hml",
    name,
    payload: { synthetic: true, simulation },
    workflow,
  });
}

function createDefaultFinancialAutomationScenarios() {
  return Object.freeze([
    scenario("success", "Sucesso", "Execucao sintetica concluida com sucesso.", "success", { success: true }),
    scenario("workflow-not-found", "Workflow inexistente", "Valida workflow nao cadastrado.", "workflow_not_found", { errorCode: "AUTOMATION_WORKFLOW_NOT_MAPPED", success: false }, "financeiro-workflow-inexistente"),
    scenario("invalid-payload", "Payload invalido", "Valida rejeicao de payload sintetico invalido.", "invalid_payload", { errorCode: "AUTOMATION_PAYLOAD_INVALID", success: false }),
    scenario("timeout", "Timeout", "Valida limite de tempo do runner.", "timeout", { errorCode: "SCENARIO_TIMEOUT", success: false }),
    scenario("retry", "Retry", "Valida recuperacao apos falha transitoria.", "retry", { attempts: 2, success: true }),
    scenario("integration-error", "Erro de integracao", "Valida falha simulada de integracao.", "integration_error", { errorCode: "AUTOMATION_INTEGRATION_ERROR", success: false }),
    scenario("unexpected-error", "Erro inesperado", "Valida isolamento de erro inesperado.", "unexpected_error", { errorCode: "SCENARIO_UNEXPECTED_ERROR", success: false }),
  ]);
}

const DEFAULT_FINANCIAL_AUTOMATION_SCENARIOS = createDefaultFinancialAutomationScenarios();

module.exports = { createDefaultFinancialAutomationScenarios, DEFAULT_FINANCIAL_AUTOMATION_SCENARIOS };
