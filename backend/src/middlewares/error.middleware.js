const { logHttpError } = require("../observability/http-observability.middleware.js");

module.exports = (error, req, res, _next) => {
  const timestamp = new Date().toISOString();
  const status = Number(error?.statusCode || error?.status || 500);
  const code = error?.code || error?.errorCode || "INTERNAL_ERROR";
  const requestId = req?.id || req?.headers?.["x-request-id"] || null;
  const endpoint = req?.originalUrl || req?.url || "/";
  const message =
    status >= 500 && !error?.expose
      ? "Erro interno do servidor. Consulte os logs para mais detalhes."
      : error?.message || "Erro interno do servidor.";

  logHttpError(error, req, {
    endpoint,
    environment: process.env.NODE_ENV || "development",
    timestamp,
  });

  return res.status(status).json({
    success: false,
    message,
    code,
    requestId,
    timestamp,
  });
};
