const {
  FinancialAutomationService,
} = require("../../application/services/financial-automation.service.js");

const FINANCIAL_AUTOMATION_CONTROLLER_ERROR_CODE = "FINANCIAL_AUTOMATION_CONTROLLER_ERROR";

const CONTROLLED_ERROR_STATUS_BY_CODE = Object.freeze({
  FINANCIAL_AUTOMATION_INPUT_REQUIRED: 400,
  FINANCIAL_AUTOMATION_INVALID_DAYS: 400,
  FINANCIAL_AUTOMATION_INVALID_EVENT: 400,
  FINANCIAL_AUTOMATION_INVALID_PAYMENT_STATUS: 400,
  FINANCIAL_AUTOMATION_PROCESS_INPUT_INVALID: 400,
});

class FinancialAutomationController {
  constructor(options = {}) {
    this.service =
      options.service || options.automationService || new FinancialAutomationService(options);

    this.listUpcoming = this.listUpcoming.bind(this);
    this.listOverdue = this.listOverdue.bind(this);
    this.listPayments = this.listPayments.bind(this);
    this.recordEvent = this.recordEvent.bind(this);
    this.process = this.process.bind(this);
  }

  async listUpcoming(req, res, next) {
    try {
      const data = await this.getService().listUpcomingInstallments(readObject(req.query));
      return res.json(successEnvelope(data));
    } catch (error) {
      return handleFinancialAutomationError(error, res, next);
    }
  }

  async listOverdue(req, res, next) {
    try {
      const data = await this.getService().listOverdueInstallments(readObject(req.query));
      return res.json(successEnvelope(data));
    } catch (error) {
      return handleFinancialAutomationError(error, res, next);
    }
  }

  async listPayments(req, res, next) {
    try {
      const data = await this.getService().listPayments(readObject(req.query));
      return res.json(successEnvelope(data));
    } catch (error) {
      return handleFinancialAutomationError(error, res, next);
    }
  }

  async recordEvent(req, res, next) {
    try {
      const data = await this.getService().recordEvent({
        ...readObject(req.body),
        requestedBy: readServiceActor(req),
      });

      return res.status(data.created ? 201 : 200).json(successEnvelope(data));
    } catch (error) {
      return handleFinancialAutomationError(error, res, next);
    }
  }

  async process(req, res, next) {
    try {
      const data = await this.getService().process({
        ...readObject(req.body),
        requestedBy: readServiceActor(req),
      });

      return res.json(successEnvelope(data));
    } catch (error) {
      return handleFinancialAutomationError(error, res, next);
    }
  }

  getService() {
    if (!this.service || typeof this.service.listUpcomingInstallments !== "function") {
      throw new TypeError("FinancialAutomationController requires FinancialAutomationService.");
    }

    return this.service;
  }
}

function successEnvelope(data) {
  return {
    data,
    success: true,
  };
}

function handleFinancialAutomationError(error, res, next) {
  const code = nullableText(error?.code, 100);

  if (code && CONTROLLED_ERROR_STATUS_BY_CODE[code]) {
    return res.status(CONTROLLED_ERROR_STATUS_BY_CODE[code]).json({
      code,
      error:
        error instanceof Error ? error.message : String(error ?? "Financial automation error."),
      missingFields: Array.isArray(error?.missingFields) ? error.missingFields : undefined,
      success: false,
    });
  }

  return next(error);
}

function readServiceActor(req = {}) {
  return (
    nullableText(req.headers?.["x-service-name"], 191) ||
    nullableText(req.headers?.["x-n8n-workflow"], 191) ||
    "n8n"
  );
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function nullableText(value, max = 65535) {
  const normalized = String(value ?? "")
    .trim()
    .slice(0, max);
  return normalized || null;
}

module.exports = {
  CONTROLLED_ERROR_STATUS_BY_CODE,
  FINANCIAL_AUTOMATION_CONTROLLER_ERROR_CODE,
  FinancialAutomationController,
  handleFinancialAutomationError,
  readServiceActor,
  successEnvelope,
};
