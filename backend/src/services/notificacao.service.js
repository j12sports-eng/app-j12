const { query } = require("../config/db");

async function criarNotificacao({ alunoId, titulo, mensagem, tipo = "info" }) {
  const existente = await query(
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

  if (Array.isArray(existente) && existente.length > 0) {
    return null;
  }

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
  criarNotificacao,
};
