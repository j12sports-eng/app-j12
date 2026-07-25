const { readTokenParam } = require("./enrollment-invitation-public.controller.js");

class DigitalEnrollmentFormController {
  constructor({ formService, logger = null } = {}) {
    this.formService = formService;
    this.logger = logger;
    for (const method of [
      "getForm",
      "updateResponsible",
      "updateStudent",
      "updateAddress",
      "updateAdditionalInformation",
      "advanceStep",
      "getReview",
    ]) {
      this[method] = this[method].bind(this);
    }
  }

  getForm(req, res) {
    return this.execute("getForm", req, res);
  }
  updateResponsible(req, res) {
    return this.execute("updateResponsible", req, res);
  }
  updateStudent(req, res) {
    return this.execute("updateStudent", req, res);
  }
  updateAddress(req, res) {
    return this.execute("updateAddress", req, res);
  }
  updateAdditionalInformation(req, res) {
    return this.execute("updateAdditionalInformation", req, res);
  }
  advanceStep(req, res) {
    return this.execute("advanceStep", req, res);
  }
  getReview(req, res) {
    return this.execute("getReview", req, res);
  }

  async execute(operation, req, res) {
    try {
      const service = this.formService;
      if (!service || typeof service[operation] !== "function") throw new TypeError("Form service unavailable.");
      const token = readTokenParam(req);
      const data =
        operation === "getForm" || operation === "getReview"
          ? await service[operation](token)
          : await service[operation](token, req.body || {});
      return res.json({ data, success: true });
    } catch (error) {
      this.logger?.warn?.("[enrollments] digital form request rejected", {
        code: String(error?.code || "DIGITAL_ENROLLMENT_NOT_AVAILABLE").slice(0, 96),
        operation,
        result: "rejected",
      });
      const status = [400, 404, 409].includes(error?.statusCode) ? error.statusCode : 404;
      return res.status(status).json({
        code: error?.code || "DIGITAL_ENROLLMENT_NOT_AVAILABLE",
        error:
          status === 409
            ? "O formulario foi atualizado em outra sessao."
            : status === 400
              ? "Dados do formulario invalidos."
              : "Formulario de matricula indisponivel.",
        success: false,
      });
    }
  }
}

module.exports = { DigitalEnrollmentFormController };
