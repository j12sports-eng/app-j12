const { PaymentProviderId } = require("../../entities/payment.entity.js");
const { PlannedPaymentProvider } = require("../providers/payment-provider.interface.js");
const { PaymentProviderInter } = require("../../providers/inter/payment-provider-inter.js");
const {
  PAYMENT_PROVIDER_UNSUPPORTED_CODE,
  SUPPORTED_PAYMENT_PROVIDERS,
  controlledError,
  validatePaymentProvider,
} = require("../validators/payment.validators.js");

class PaymentGatewayFactory {
  constructor(options = {}) {
    this.options = options;
    this.providers = new Map();
    this.registerDefaults(options.providers);
  }

  registerProvider(provider) {
    if (!provider || typeof provider !== "object") {
      throw new TypeError("PaymentGatewayFactory requires provider object.");
    }

    const id = validatePaymentProvider(provider.id);

    for (const method of ["createCharge", "updateCharge", "cancelCharge", "getCharge"]) {
      if (typeof provider[method] !== "function") {
        throw new TypeError(`Payment provider ${id} must implement ${method}.`);
      }
    }

    this.providers.set(id, provider);
    return provider;
  }

  getProvider(providerId = PaymentProviderId.BANCO_INTER) {
    const id = validatePaymentProvider(providerId);
    const provider = this.providers.get(id);

    if (!provider) {
      throw controlledError(
        `Payment provider ${id} nao registrado.`,
        PAYMENT_PROVIDER_UNSUPPORTED_CODE,
        {
          provider: id,
          supportedProviders: this.listProviders(),
        },
      );
    }

    return provider;
  }

  listProviders() {
    return Array.from(this.providers.keys()).sort();
  }

  registerDefaults(overrides) {
    const customProviders = Array.isArray(overrides) ? overrides : [];

    for (const provider of customProviders) {
      this.registerProvider(provider);
    }

    for (const providerId of SUPPORTED_PAYMENT_PROVIDERS) {
      if (this.providers.has(providerId)) continue;

      if (providerId === PaymentProviderId.BANCO_INTER) {
        this.registerProvider(
          new PaymentProviderInter(
            this.options.bancoInterOptions || this.options.interOptions || {},
          ),
        );
        continue;
      }

      this.registerProvider(
        new PlannedPaymentProvider({
          displayName: displayNameForProvider(providerId),
          id: providerId,
        }),
      );
    }
  }
}

function displayNameForProvider(providerId) {
  if (providerId === PaymentProviderId.BANCO_INTER) return "Banco Inter";
  if (providerId === PaymentProviderId.ASAAS) return "Asaas";
  if (providerId === PaymentProviderId.INFINITE_PAY) return "InfinitePay";
  if (providerId === PaymentProviderId.MERCADO_PAGO) return "Mercado Pago";
  if (providerId === PaymentProviderId.CORA) return "Cora";
  return "Manual";
}

module.exports = {
  PaymentGatewayFactory,
  displayNameForProvider,
};
