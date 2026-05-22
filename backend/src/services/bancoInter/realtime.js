function emitFinancialPaymentUpdated(payload) {
  const io = global.io;
  if (!io || typeof io.emit !== "function") return;

  io.emit("financeiro:pagamento-atualizado", payload);
  io.emit("dashboard:financeiro-atualizado", payload);
}

module.exports = {
  emitFinancialPaymentUpdated,
};
