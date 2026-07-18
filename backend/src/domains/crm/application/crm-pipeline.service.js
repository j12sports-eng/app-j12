const {
  ALLOWED,
  PIPELINE_STAGE_DEFINITIONS,
  assertLeadStageTransition,
  getAllowedLeadStageTransitions,
} = require("../domain/lead-stage-transition-policy.js");

const PIPELINE_CARD_FIELDS = Object.freeze([
  field("leadId", "Lead ID"),
  field("source", "Origem"),
  field("assignedTo", "Responsável"),
  field("status", "Status"),
  field("updatedAt", "Última atualização"),
]);

class CrmPipelineService {
  getPipeline() {
    const stages = PIPELINE_STAGE_DEFINITIONS.map((definition) =>
      Object.freeze({
        ...definition,
        transitions: getAllowedLeadStageTransitions(definition.id),
      }),
    );
    return Object.freeze({
      cardFields: PIPELINE_CARD_FIELDS,
      stages: Object.freeze(stages),
      transitions: Object.freeze(
        Object.entries(ALLOWED).flatMap(([from, destinations]) =>
          destinations.map((to) => Object.freeze({ from, to })),
        ),
      ),
    });
  }

  validateTransition(currentStage, nextStage) {
    assertLeadStageTransition(currentStage, nextStage);
    return Object.freeze({ currentStage, nextStage, valid: true });
  }

  getPossibleStages(currentStage) {
    return getAllowedLeadStageTransitions(currentStage);
  }
}

function field(key, label) {
  return Object.freeze({ configurable: true, key, label, visible: true });
}

module.exports = { CrmPipelineService, PIPELINE_CARD_FIELDS };
