const PIPELINE_STAGES = Object.freeze(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]);
const TERMINAL_STAGES = new Set(["WON", "LOST"]);
const ALLOWED = Object.freeze({
  NEW: ["CONTACTED", "LOST"],
  CONTACTED: ["QUALIFIED", "LOST"],
  QUALIFIED: ["PROPOSAL", "LOST"],
  PROPOSAL: ["NEGOTIATION", "LOST"],
  NEGOTIATION: ["WON", "LOST"],
  WON: [],
  LOST: [],
});
function assertLeadStageTransition(current, next) {
  if (!PIPELINE_STAGES.includes(next)) throw error("CRM_STAGE_INVALID");
  if (current === next) throw error("CRM_STAGE_UNCHANGED");
  if (TERMINAL_STAGES.has(current)) throw error("CRM_STAGE_TERMINAL");
  if (!ALLOWED[current]?.includes(next)) throw error("CRM_STAGE_TRANSITION_INVALID");
  return true;
}
function error(code) { return Object.assign(new Error(code), { code }); }
module.exports = { ALLOWED, PIPELINE_STAGES, TERMINAL_STAGES, assertLeadStageTransition };
