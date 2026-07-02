const {
  findDuplicateNotificationForToday,
  insertNotification,
} = require("../repositories/notificacao.repository.js");

async function criarNotificacao({ alunoId, titulo, mensagem, tipo = "info" }) {
  const existente = await findDuplicateNotificationForToday({ alunoId, titulo, mensagem });

  if (Array.isArray(existente) && existente.length > 0) {
    return null;
  }

  return insertNotification({ alunoId, titulo, mensagem, tipo });
}

module.exports = {
  criarNotificacao,
};
