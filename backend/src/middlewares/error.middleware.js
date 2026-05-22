module.exports = (error, req, res, next) => {
  console.error("❌ GLOBAL ERROR:", error);

  // ================= STATUS =================

  const status = error.status || 500;

  // ================= MESSAGE =================

  const message = error.message || "Erro interno servidor";

  // ================= RESPONSE =================

  return res.status(status).json({
    success: false,

    error: message,
  });
};
