class Round {
  constructor(input = {}) {
    this.id = input.id || null;
    this.phaseId = input.phaseId || null;
    this.name = input.name || "";
    this.order = Number.isFinite(Number(input.order)) ? Number(input.order) : 0;
    this.status = input.status || "DRAFT";
  }
}

module.exports = {
  Round,
};
