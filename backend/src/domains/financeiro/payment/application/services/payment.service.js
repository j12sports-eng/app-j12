const { toPaymentDto } = require("../dtos/payment.dto.js");
const { PaymentGatewayFactory } = require("./payment-gateway.factory.js");
const { validatePaymentProvider } = require("../validators/payment.validators.js");

class PaymentService {
  constructor(options = {}) {
    this.gatewayFactory = options.gatewayFactory || new PaymentGatewayFactory(options);
    this.repository = options.repository || options.paymentRepository || null;
  }

  async listProviderPayments(input = {}) {
    const providerId = validatePaymentProvider(input.provider);
    const provider = this.gatewayFactory.getProvider(providerId);
    const result = await provider.listPayments(input);

    return {
      items: Array.isArray(result.items) ? result.items.map(toPaymentDto) : [],
      provider: providerId,
      providerIntegrated: result.integrated === true,
      raw: result,
    };
  }

  getRepository() {
    if (!this.repository) {
      throw new TypeError("PaymentService requires payment repository.");
    }

    return this.repository;
  }
}

module.exports = {
  PaymentService,
};
