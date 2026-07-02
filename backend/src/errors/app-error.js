class AppError extends Error {
  constructor(message, options = {}) {
    const { cause, code = "APP_ERROR", details = null, expose, statusCode = 500 } = options;

    super(message, cause ? { cause } : undefined);

    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.expose = expose ?? statusCode < 500;
    this.status = statusCode;
    this.statusCode = statusCode;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

module.exports = {
  AppError,
};
