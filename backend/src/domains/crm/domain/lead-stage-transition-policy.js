const ALLOWED = freezeTransitions({
  NEW: ["CONTACTED", "LOST"],
  CONTACTED: ["QUALIFIED", "LOST"],
  QUALIFIED: ["PROPOSAL", "LOST"],
  PROPOSAL: ["NEGOTIATION", "LOST"],
  NEGOTIATION: ["WON", "LOST"],
  WON: [],
  LOST: [],
});

const PIPELINE_STAGE_DEFINITIONS = Object.freeze([
  stage("NEW", 1, "Novo", "Lead recebido e ainda não contatado.", "#fb923c"),
  stage("CONTACTED", 2, "Contatado", "Primeiro contato comercial realizado.", "#38bdf8"),
  stage("QUALIFIED", 3, "Qualificado", "Lead com aderência comercial confirmada.", "#a78bfa"),
  stage("PROPOSAL", 4, "Proposta", "Proposta comercial apresentada.", "#facc15"),
  stage("NEGOTIATION", 5, "Negociação", "Condições comerciais em negociação.", "#f472b6"),
  stage("WON", 6, "Ganho", "Oportunidade comercial conquistada.", "#34d399", true),
  stage("LOST", 7, "Perdido", "Oportunidade encerrada sem conversão.", "#94a3b8", true),
]);
const PIPELINE_STAGES = Object.freeze(PIPELINE_STAGE_DEFINITIONS.map(({ id }) => id));
const TERMINAL_STAGES = new Set(["WON", "LOST"]);

function getAllowedLeadStageTransitions(current) {
  if (!PIPELINE_STAGES.includes(current)) throw error("CRM_STAGE_INVALID");
  return ALLOWED[current];
}

function assertLeadStageTransition(current, next) {
  if (!PIPELINE_STAGES.includes(current) || !PIPELINE_STAGES.includes(next)) {
    throw error("CRM_STAGE_INVALID");
  }
  if (current === next) throw error("CRM_STAGE_UNCHANGED");
  if (TERMINAL_STAGES.has(current)) throw error("CRM_STAGE_TERMINAL");
  if (!ALLOWED[current].includes(next)) throw error("CRM_STAGE_TRANSITION_INVALID");
  return true;
}

function stage(id, order, label, description, color, terminal = false) {
  return Object.freeze({ color, description, id, label, order, terminal });
}

function freezeTransitions(transitions) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(transitions).map(([current, next]) => [current, Object.freeze([...next])]),
    ),
  );
}

function error(code) {
  return Object.assign(new Error(code), { code });
}

module.exports = {
  ALLOWED,
  PIPELINE_STAGE_DEFINITIONS,
  PIPELINE_STAGES,
  TERMINAL_STAGES,
  assertLeadStageTransition,
  getAllowedLeadStageTransitions,
};
