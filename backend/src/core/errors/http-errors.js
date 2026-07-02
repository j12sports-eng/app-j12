const { AppError } = require("./app-error.js");

/**
 * Error used when request validation fails.
 */
class ValidationError extends AppError {
  /**
   * @param {string} [message]
   * @param {{ code?: string, details?: unknown }} [options]
   */
  constructor(message = "Dados invalidos.", options = {}) {
    super(message, {
      code: options.code || "VALIDATION_ERROR",
      details: options.details || null,
      expose: true,
      statusCode: 400,
    });

    this.name = "ValidationError";
  }
}

/**
 * Error used when an entity or resource cannot be found.
 */
class NotFoundError extends AppError {
  /**
   * @param {string} [message]
   * @param {{ code?: string, details?: unknown }} [options]
   */
  constructor(message = "Recurso nao encontrado.", options = {}) {
    super(message, {
      code: options.code || "NOT_FOUND",
      details: options.details || null,
      expose: true,
      statusCode: 404,
    });

    this.name = "NotFoundError";
  }
}

/**
 * Error used when the current request is not authenticated.
 */
class UnauthorizedError extends AppError {
  /**
   * @param {string} [message]
   * @param {{ code?: string, details?: unknown }} [options]
   */
  constructor(message = "Nao autorizado.", options = {}) {
    super(message, {
      code: options.code || "UNAUTHORIZED",
      details: options.details || null,
      expose: true,
      statusCode: 401,
    });

    this.name = "UnauthorizedError";
  }
}

module.exports = {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
};
