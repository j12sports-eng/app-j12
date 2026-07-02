class BaseValidator {
  assert(payload) {
    const result = this.validate(payload);

    if (!result.valid) {
      const error = new Error("Dados invalidos.");
      error.code = "VALIDATION_ERROR";
      error.details = result.errors;
      error.statusCode = 400;
      throw error;
    }

    return payload;
  }

  validate() {
    return {
      errors: [],
      valid: true,
    };
  }
}

module.exports = {
  BaseValidator,
};
