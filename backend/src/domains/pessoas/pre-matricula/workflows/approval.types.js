/**
 * Domain contracts for the future Pre-Matricula approval workflow.
 *
 * This file models workflow concepts only. It does not create database schema,
 * SQL, APIs, endpoints, routes, controllers, integrations or side effects.
 */

const APPROVAL_WORKFLOW_STATUS = Object.freeze({
  BLOCKED: "BLOCKED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  NOT_STARTED: "NOT_STARTED",
  READY: "READY",
  RUNNING: "RUNNING",
});

const APPROVAL_STEP_STATUS = Object.freeze({
  BLOCKED: "BLOCKED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  PENDING: "PENDING",
  SKIPPED: "SKIPPED",
});

const APPROVAL_STEP_TYPE = Object.freeze({
  ATIVAR_MATRICULA: "ATIVAR_MATRICULA",
  CRIAR_PERFIL_ALUNO: "CRIAR_PERFIL_ALUNO",
  CRIAR_PERFIL_RESPONSAVEL: "CRIAR_PERFIL_RESPONSAVEL",
  CRIAR_PESSOA_ALUNO: "CRIAR_PESSOA_ALUNO",
  CRIAR_PESSOA_RESPONSAVEL: "CRIAR_PESSOA_RESPONSAVEL",
  CRIAR_RELACIONAMENTO: "CRIAR_RELACIONAMENTO",
  GERAR_CONTRATO: "GERAR_CONTRATO",
  GERAR_FINANCEIRO: "GERAR_FINANCEIRO",
  VALIDAR_PRE_MATRICULA: "VALIDAR_PRE_MATRICULA",
});

/**
 * @typedef {Object} ApprovalStepDefinition
 * @property {number} order Execution order planned for the future workflow.
 * @property {string} key Stable workflow step key.
 * @property {string} type Workflow step type.
 * @property {string} label Human-readable label.
 * @property {string} description Step purpose.
 * @property {string[]} dependencies Keys that must complete first.
 * @property {boolean} integrationRequired Whether this step requires future external/domain integration.
 * @property {boolean} implemented Whether this step is executable today.
 * @property {string[]} futureOutputs Expected future output references.
 */

/**
 * @typedef {Object} ApprovalStepState
 * @property {number} order Execution order planned for the future workflow.
 * @property {string} key Stable workflow step key.
 * @property {string} type Workflow step type.
 * @property {string} status Current step status.
 * @property {string[]} dependencies Keys that must complete first.
 * @property {string[]} blockers Human-readable blockers.
 * @property {Record<string, unknown>|null} output Future step output.
 */

/**
 * @typedef {Object} ApprovalWorkflowPlan
 * @property {string|null} prematriculaId Pre-registration id.
 * @property {string} status Workflow status.
 * @property {ApprovalStepState[]} steps Step states.
 * @property {string[]} blockers Workflow blockers.
 * @property {boolean} executable Whether the workflow can be executed today.
 */

module.exports = {
  APPROVAL_STEP_STATUS,
  APPROVAL_STEP_TYPE,
  APPROVAL_WORKFLOW_STATUS,
};
