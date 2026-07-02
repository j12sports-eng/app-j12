const { APPROVAL_STEP_KEYS, APPROVAL_STEPS } = require("./approval.steps.js");
const {
  APPROVAL_STEP_STATUS,
  APPROVAL_WORKFLOW_STATUS,
} = require("./approval.types.js");

/**
 * Conceptual approval workflow for Pre-Matricula.
 *
 * This class creates a plan and dependency state for the future approval flow.
 * It does not execute integrations, persist data, create Pessoa records, create
 * contracts, generate finance entries, call APIs or mutate existing modules.
 */
class PrematriculaApprovalWorkflow {
  /**
   * @param {Object} [options]
   * @param {readonly import("./approval.types.js").ApprovalStepDefinition[]} [options.steps]
   */
  constructor({ steps = APPROVAL_STEPS } = {}) {
    this.steps = steps;
  }

  /**
   * Builds a non-executable approval plan for a pre-registration.
   *
   * @param {Object} [input]
   * @param {string|null} [input.prematriculaId]
   * @param {string[]} [input.completedSteps]
   * @returns {import("./approval.types.js").ApprovalWorkflowPlan}
   */
  buildPlan({ prematriculaId = null, completedSteps = [] } = {}) {
    const completed = new Set(completedSteps);
    const blockers = [];

    if (!prematriculaId) {
      blockers.push("prematriculaId e necessario para executar o workflow futuramente.");
    }

    const states = this.steps.map((step) => {
      const missingDependencies = step.dependencies.filter((dependency) => !completed.has(dependency));
      const stepBlockers = [];

      if (!step.implemented) {
        stepBlockers.push("Etapa modelada, mas integracao ainda nao implementada.");
      }

      if (missingDependencies.length > 0) {
        stepBlockers.push(`Dependencias pendentes: ${missingDependencies.join(", ")}.`);
      }

      return {
        blockers: stepBlockers,
        dependencies: [...step.dependencies],
        key: step.key,
        order: step.order,
        output: null,
        status: resolveStepStatus(step, completed, missingDependencies),
        type: step.type,
      };
    });

    return {
      blockers,
      executable: false,
      prematriculaId,
      status: resolveWorkflowStatus(blockers, states),
      steps: states,
    };
  }

  /**
   * Returns the ordered step keys for documentation and future adapters.
   *
   * @returns {string[]}
   */
  getOrderedStepKeys() {
    return this.steps.map((step) => step.key);
  }
}

/**
 * Resolves the current status of a modeled step.
 *
 * @param {import("./approval.types.js").ApprovalStepDefinition} step
 * @param {Set<string>} completed
 * @param {string[]} missingDependencies
 * @returns {string}
 */
function resolveStepStatus(step, completed, missingDependencies) {
  if (completed.has(step.key)) {
    return APPROVAL_STEP_STATUS.COMPLETED;
  }

  if (missingDependencies.length > 0) {
    return APPROVAL_STEP_STATUS.BLOCKED;
  }

  return step.implemented ? APPROVAL_STEP_STATUS.PENDING : APPROVAL_STEP_STATUS.BLOCKED;
}

/**
 * Resolves the modeled workflow status.
 *
 * @param {string[]} blockers
 * @param {import("./approval.types.js").ApprovalStepState[]} states
 * @returns {string}
 */
function resolveWorkflowStatus(blockers, states) {
  if (blockers.length > 0) {
    return APPROVAL_WORKFLOW_STATUS.BLOCKED;
  }

  if (states.every((state) => state.status === APPROVAL_STEP_STATUS.COMPLETED)) {
    return APPROVAL_WORKFLOW_STATUS.COMPLETED;
  }

  if (states.some((state) => state.status === APPROVAL_STEP_STATUS.BLOCKED)) {
    return APPROVAL_WORKFLOW_STATUS.BLOCKED;
  }

  return APPROVAL_WORKFLOW_STATUS.READY;
}

module.exports = {
  APPROVAL_STEP_KEYS,
  PrematriculaApprovalWorkflow,
  resolveStepStatus,
  resolveWorkflowStatus,
};
