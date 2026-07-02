const { query } = require("../config/db.js");

async function findDuplicateNotificationForToday({ alunoId, titulo, mensagem }) {
  return query(
    `
      SELECT id
      FROM j12_notificacoes
      WHERE aluno_id = ?
      AND titulo = ?
      AND mensagem = ?
      AND DATE(created_at) = CURDATE()
      LIMIT 1
    `,
    [alunoId, titulo, mensagem],
  );
}

async function insertNotification({ alunoId, titulo, mensagem, tipo }) {
  return query(
    `
      INSERT INTO j12_notificacoes (
        aluno_id,
        titulo,
        mensagem,
        tipo,
        lida,
        created_at
      )
      VALUES (?, ?, ?, ?, 0, NOW())
    `,
    [alunoId, titulo, mensagem, tipo],
  );
}

module.exports = {
  findDuplicateNotificationForToday,
  insertNotification,
};
