class PaymentProvider {
  constructor(options = {}) {
    this.id = options.id || "provider";
    this.displayName = options.displayName || this.id;
  }

  async createCharge() {
    throw new TypeError(`${this.displayName} must implement createCharge.`);
  }

  async updateCharge() {
    throw new TypeError(`${this.displayName} must implement updateCharge.`);
  }

  async cancelCharge() {
    throw new TypeError(`${this.displayName} must implement cancelCharge.`);
  }

  async getCharge() {
    throw new TypeError(`${this.displayName} must implement getCharge.`);
  }

  async listPayments() {
    throw new TypeError(`${this.displayName} must implement listPayments.`);
  }
}

class PlannedPaymentProvider extends PaymentProvider {
  constructor(options = {}) {
    super(options);
    this.phase = options.phase || "SPRINT_20_1_PHASE_A";
  }

  async createCharge(input = {}) {
    return this.buildPlannedResult("createCharge", input);
  }

  async updateCharge(input = {}) {
    return this.buildPlannedResult("updateCharge", input);
  }

  async cancelCharge(input = {}) {
    return this.buildPlannedResult("cancelCharge", input);
  }

  async getCharge(input = {}) {
    return this.buildPlannedResult("getCharge", input);
  }

  async listPayments(input = {}) {
    return this.buildPlannedResult("listPayments", input);
  }

  buildPlannedResult(action, input = {}) {
    return {
      action,
      externalId: null,
      integrated: false,
      message:
        "Provider registrado para fase de arquitetura; chamada externa ainda nao implementada.",
      provider: this.id,
      requestedChargeId: input.id || input.legacyChargeId || null,
      status: "NOT_IMPLEMENTED",
      phase: this.phase,
    };
  }
}

module.exports = {
  PaymentProvider,
  PlannedPaymentProvider,
};
