const {
  PaymentProviderInter,
} = require("../../../payment/providers/inter/payment-provider-inter.js");

const INTER_ADMIN_ERROR_CODE = "INTER_ADMIN_ERROR";

const CONTROLLED_ERROR_STATUS_BY_CODE = Object.freeze({
  INTER_CHARGE_INPUT_REQUIRED: 400,
  INTER_CHARGE_LOOKUP_REQUIRED: 400,
  INTER_CHARGE_NOT_FOUND: 404,
  INTER_CLIENT_CREDENTIALS_MISSING: 503,
  INTER_INPUT_REQUIRED: 400,
  INTER_PAYMENT_NOT_FOUND: 404,
  INTER_PIX_KEY_MISSING: 503,
  INTER_SYNC_INPUT_INVALID: 400,
  INTER_WEBHOOK_INPUT_INVALID: 400,
  INTER_WEBHOOK_SIGNATURE_INVALID: 401,
  INTER_PROVIDER_CHARGE_NOT_FOUND: 404,
  INTER_PROVIDER_INPUT_REQUIRED: 400,
  INTER_PROVIDER_PAYMENT_NOT_FOUND: 404,
  INTER_PROVIDER_PIX_COPY_PASTE_MISSING: 502,
  INTER_PROVIDER_PIX_KEY_MISSING: 503,
  INTER_PROVIDER_SYNC_INPUT_INVALID: 400,
  INTER_PROVIDER_TXID_REQUIRED: 400,
  INTER_PROVIDER_WEBHOOK_INPUT_INVALID: 400,
  INTER_PROVIDER_WEBHOOK_SIGNATURE_INVALID: 401,
  INTER_MTLS_CERTIFICATE_MISSING: 503,
  INTER_OAUTH_CREDENTIALS_MISSING: 503,
  INTER_OAUTH_TOKEN_MISSING: 502,
});

class InterAdminController {
  constructor(options = {}) {
    this.interService =
      options.interService || options.interProvider || new PaymentProviderInter(options);

    this.createCharge = this.createCharge.bind(this);
    this.createPix = this.createPix.bind(this);
    this.cancelPix = this.cancelPix.bind(this);
    this.getCharge = this.getCharge.bind(this);
    this.getPix = this.getPix.bind(this);
    this.sync = this.sync.bind(this);
    this.webhook = this.webhook.bind(this);
  }

  async createCharge(req, res, next) {
    try {
      const service = this.getService();
      const data = await callService(service, ["emitirCobranca", "createPix"], {
        ...readObject(req.body),
        requestedBy: readActor(req),
      });

      return res.status(201).json(successEnvelope(data));
    } catch (error) {
      return handleInterAdminError(error, res, next);
    }
  }

  async createPix(req, res, next) {
    try {
      const data = await callService(this.getService(), ["createPix", "emitirCobranca"], {
        ...readObject(req.body),
        requestedBy: readActor(req),
      });

      return res.status(201).json(successEnvelope(data));
    } catch (error) {
      return handleInterAdminError(error, res, next);
    }
  }

  async getCharge(req, res, next) {
    try {
      const data = await callService(this.getService(), ["consultarCobranca", "getPix"], {
        id: req?.params?.id,
      });

      return res.json(successEnvelope(data));
    } catch (error) {
      return handleInterAdminError(error, res, next);
    }
  }

  async getPix(req, res, next) {
    try {
      const data = await callService(this.getService(), ["getPix", "consultarCobranca"], {
        txid: req?.params?.txid,
      });

      return res.json(successEnvelope(data));
    } catch (error) {
      return handleInterAdminError(error, res, next);
    }
  }

  async cancelPix(req, res, next) {
    try {
      const data = await callService(this.getService(), ["cancelPix", "cancelarCobranca"], {
        ...readObject(req.body),
        requestedBy: readActor(req),
        txid: req?.params?.txid,
      });

      return res.json(successEnvelope(data));
    } catch (error) {
      return handleInterAdminError(error, res, next);
    }
  }

  async sync(req, res, next) {
    try {
      const data = await callService(
        this.getService(),
        ["sincronizar", "sync"],
        readObject(req.body),
      );

      return res.json(successEnvelope(data));
    } catch (error) {
      return handleInterAdminError(error, res, next);
    }
  }

  async webhook(req, res, next) {
    try {
      const data = await callService(this.getService(), ["processarWebhook", "processWebhook"], {
        body: readObject(req.body),
        headers: readObject(req.headers),
      });

      return res.json(successEnvelope(data));
    } catch (error) {
      return handleInterAdminError(error, res, next);
    }
  }

  getService() {
    if (!this.interService || typeof this.interService !== "object") {
      throw new TypeError("InterAdminController requires Banco Inter provider.");
    }

    return this.interService;
  }
}

async function callService(service, methods, input) {
  for (const method of methods) {
    if (typeof service?.[method] === "function") {
      return service[method](input);
    }
  }

  throw new TypeError(`Banco Inter service requires one of: ${methods.join(", ")}.`);
}

function successEnvelope(data) {
  return {
    data,
    success: true,
  };
}

function handleInterAdminError(error, res, next) {
  const code = nullableText(error?.code, 100);

  if (code && CONTROLLED_ERROR_STATUS_BY_CODE[code]) {
    return res.status(CONTROLLED_ERROR_STATUS_BY_CODE[code]).json({
      code,
      error: error instanceof Error ? error.message : String(error ?? "Erro Banco Inter."),
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
  INTER_ADMIN_ERROR_CODE,
  InterAdminController,
  callService,
  handleInterAdminError,
  successEnvelope,
};
