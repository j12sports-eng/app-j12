const { ChargeService } = require("../../application/services/charge.service.js");
const {
  PAYMENT_CHARGE_INPUT_REQUIRED_CODE,
  PAYMENT_CHARGE_INVALID_STATUS_CODE,
  PAYMENT_CHARGE_LOOKUP_REQUIRED_CODE,
  PAYMENT_CHARGE_UPDATE_EMPTY_CODE,
  PAYMENT_PROVIDER_UNSUPPORTED_CODE,
} = require("../../application/validators/payment.validators.js");
const { PAYMENT_CHARGE_NOT_FOUND_CODE } = require("../../application/services/charge.service.js");

const PAYMENT_ADMIN_ERROR_CODE = "PAYMENT_ADMIN_ERROR";

const CONTROLLED_ERROR_STATUS_BY_CODE = Object.freeze({
  PAYMENT_CHARGE_INPUT_REQUIRED: 400,
  PAYMENT_CHARGE_INVALID_STATUS: 400,
  PAYMENT_CHARGE_LOOKUP_REQUIRED: 400,
  PAYMENT_CHARGE_NOT_FOUND: 404,
  PAYMENT_CHARGE_UPDATE_EMPTY: 400,
  PAYMENT_PROVIDER_UNSUPPORTED: 400,
});

class PaymentAdminController {
  constructor(options = {}) {
    this.chargeService = options.chargeService || new ChargeService(options);

    this.createCharge = this.createCharge.bind(this);
    this.listCharges = this.listCharges.bind(this);
    this.getCharge = this.getCharge.bind(this);
    this.updateCharge = this.updateCharge.bind(this);
    this.deleteCharge = this.deleteCharge.bind(this);
  }

  async createCharge(req, res, next) {
    try {
      const data = await this.getChargeService().createCharge({
        ...readObject(req.body),
        requestedBy: readActor(req),
      });

      return res.status(201).json(successEnvelope(data));
    } catch (error) {
      return handlePaymentAdminError(error, res, next);
    }
  }

  async listCharges(req, res, next) {
    try {
      const data = await this.getChargeService().listCharges(readObject(req.query));
      return res.json(successEnvelope(data));
    } catch (error) {
      return handlePaymentAdminError(error, res, next);
    }
  }

  async getCharge(req, res, next) {
    try {
      const data = await this.getChargeService().getCharge({
        ...readObject(req.params),
        ...readObject(req.query),
      });

      return res.json(successEnvelope(data));
    } catch (error) {
      return handlePaymentAdminError(error, res, next);
    }
  }

  async updateCharge(req, res, next) {
    try {
      const data = await this.getChargeService().updateCharge({
        ...readObject(req.body),
        id: req?.params?.id,
        requestedBy: readActor(req),
      });

      return res.json(successEnvelope(data));
    } catch (error) {
      return handlePaymentAdminError(error, res, next);
    }
  }

  async deleteCharge(req, res, next) {
    try {
      const data = await this.getChargeService().deleteCharge({
        ...readObject(req.body),
        id: req?.params?.id,
        requestedBy: readActor(req),
      });

      return res.json(successEnvelope(data));
    } catch (error) {
      return handlePaymentAdminError(error, res, next);
    }
  }

  getChargeService() {
    if (!this.chargeService || typeof this.chargeService.createCharge !== "function") {
      throw new TypeError("PaymentAdminController requires ChargeService.");
    }

    return this.chargeService;
  }
}

function successEnvelope(data) {
  return {
    data,
    success: true,
  };
}

function handlePaymentAdminError(error, res, next) {
  const code = nullableText(error?.code, 100);

  if (code && CONTROLLED_ERROR_STATUS_BY_CODE[code]) {
    return res.status(CONTROLLED_ERROR_STATUS_BY_CODE[code]).json({
      code,
      error: error instanceof Error ? error.message : String(error ?? "Payment error."),
      missingFields: Array.isArray(error?.missingFields) ? error.missingFields : undefined,
      success: false,
    });
  }

  return next(error);
}

function readActor(req = {}) {
  const user = req.auth || req.user || {};
  return user.email || user.login || user.username || user.id || null;
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
  PAYMENT_ADMIN_ERROR_CODE,
  PAYMENT_CHARGE_INPUT_REQUIRED_CODE,
  PAYMENT_CHARGE_INVALID_STATUS_CODE,
  PAYMENT_CHARGE_LOOKUP_REQUIRED_CODE,
  PAYMENT_CHARGE_NOT_FOUND_CODE,
  PAYMENT_CHARGE_UPDATE_EMPTY_CODE,
  PAYMENT_PROVIDER_UNSUPPORTED_CODE,
  PaymentAdminController,
  handlePaymentAdminError,
  successEnvelope,
};
