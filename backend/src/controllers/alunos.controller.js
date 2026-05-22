const db = require("../../db");

// LISTAR TODOS
async function getAlunos(req, res) {
  try {
    const rows = await db.query("SELECT * FROM j12_alunos ORDER BY id DESC");

    // db.query ja retorna o array de linhas; desestruturar aqui devolve so o primeiro aluno.
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar alunos:", error);
    res.status(500).json({ message: "Erro ao buscar alunos" });
  }
}

// BUSCAR POR ID
async function getAlunoById(req, res) {
  try {
    const { id } = req.params;

    const rows = await db.query("SELECT * FROM j12_alunos WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Aluno não encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Erro ao buscar aluno:", error);
    res.status(500).json({ message: "Erro ao buscar aluno" });
  }
}

// CRIAR
async function createAluno(req, res) {
  try {
    const { nome_completo, email_contato, telefone_contato } = req.body;

    if (!nome_completo) {
      return res.status(400).json({ message: "Nome é obrigatório" });
    }

    const result = await db.query(
      `
      INSERT INTO j12_alunos 
      (nome_completo, email_contato, telefone_contato, status, matricula_em)
      VALUES (?, ?, ?, 'ativo', CURDATE())
      `,
      [nome_completo, email_contato || null, telefone_contato || null],
    );

    res.status(201).json({
      message: "Aluno criado com sucesso",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Erro ao criar aluno:", error);
    res.status(500).json({ message: "Erro ao criar aluno" });
  }
}

// ATUALIZAR
async function updateAluno(req, res) {
  try {
    const { id } = req.params;
    const { nome_completo, email_contato, telefone_contato } = req.body;

    await db.query(
      `
      UPDATE j12_alunos
      SET nome_completo = ?, email_contato = ?, telefone_contato = ?
      WHERE id = ?
      `,
      [nome_completo, email_contato, telefone_contato, id],
    );

    res.json({ message: "Aluno atualizado com sucesso" });
  } catch (error) {
    console.error("Erro ao atualizar aluno:", error);
    res.status(500).json({ message: "Erro ao atualizar aluno" });
  }
}

// DELETAR
async function deleteAluno(req, res) {
  try {
    const { id } = req.params;

    await db.query("DELETE FROM j12_alunos WHERE id = ?", [id]);

    res.json({ message: "Aluno removido com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar aluno:", error);
    res.status(500).json({ message: "Erro ao deletar aluno" });
  }
}

module.exports = {
  getAlunos,
  getAlunoById,
  createAluno,
  updateAluno,
  deleteAluno,
};
