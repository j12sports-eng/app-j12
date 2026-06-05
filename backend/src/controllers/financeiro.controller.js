const { pool } = require("../config/db.js");

function isAdmin(user) {
  return user?.perfil === "admin";
}

function isAluno(user) {
  return user?.perfil === "aluno";
}

function isResponsavel(user) {
  return user?.perfil === "responsavel";
}

function forbidden(res) {
  return res.status(403).json({ message: "Acesso negado ao financeiro." });
}

async function ensureFinanceiroSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS j12_configuracoes_financeiras (
      id INT AUTO_INCREMENT PRIMARY KEY,
      chave VARCHAR(100) NOT NULL UNIQUE,
      valor VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS j12_mensalidades (
      id INT AUTO_INCREMENT PRIMARY KEY,
      aluno_id INT NOT NULL,
      plano_id INT NULL,
      descricao VARCHAR(255),
      competencia VARCHAR(7),
      valor_original DECIMAL(10,2),
      valor_atualizado DECIMAL(10,2),
      data_vencimento DATE,
      status ENUM('pendente','pago','vencido','parcial','cancelado') DEFAULT 'pendente',
      forma_pagamento VARCHAR(50) NULL,
      data_pagamento DATE NULL,
      observacao TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_aluno_competencia (aluno_id, competencia),
      INDEX idx_competencia (competencia),
      INDEX idx_status (status),
      INDEX idx_aluno (aluno_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS j12_pagamentos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      mensalidade_id INT NOT NULL,
      aluno_id INT NOT NULL,
      valor_pago DECIMAL(10,2),
      forma_pagamento ENUM('pix','cartao','dinheiro','boleto','transferencia','outro'),
      data_pagamento DATE,
      observacao TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_mensalidade (mensalidade_id),
      INDEX idx_aluno (aluno_id)
    )
  `);

  await pool.query(`
    INSERT IGNORE INTO j12_configuracoes_financeiras (chave, valor)
    VALUES ('dia_vencimento_padrao', '10')
  `);
}

async function getAlunoIdsPermitidos(user) {
  if (isAdmin(user)) return null;

  if (isAluno(user)) {
    return user.aluno_id ? [Number(user.aluno_id)] : [];
  }

  if (isResponsavel(user)) {
    const responsavelId = user.responsavel_id || user.id;

    const [rows] = await pool.query(
      `
      SELECT id 
      FROM j12_alunos
      WHERE responsavel_id = ?
         OR responsavel_usuario_id = ?
         OR usuario_responsavel_id = ?
      `,
      [responsavelId, responsavelId, responsavelId],
    );

    return rows.map((row) => Number(row.id));
  }

  return [];
}

async function getResumoFinanceiro(req, res) {
  try {
    await ensureFinanceiroSchema();

    const user = req.auth || req.user;

    if (!isAdmin(user)) {
      return forbidden(res);
    }

    const competencia = req.query.competencia || new Date().toISOString().slice(0, 7);

    await pool.query(`
      UPDATE j12_mensalidades
      SET status = 'vencido'
      WHERE status = 'pendente'
        AND data_vencimento < CURDATE()
    `);

    const [[resumo]] = await pool.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN status = 'pago' THEN valor_atualizado ELSE 0 END), 0) AS recebido_mes,
        COALESCE(SUM(CASE WHEN status IN ('pendente','parcial') THEN valor_atualizado ELSE 0 END), 0) AS a_receber_mes,
        COUNT(*) AS total_mensalidades_mes,
        SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) AS mensalidades_pendentes,
        SUM(CASE WHEN status = 'pago' THEN 1 ELSE 0 END) AS mensalidades_pagas,
        SUM(CASE WHEN status = 'vencido' THEN 1 ELSE 0 END) AS mensalidades_vencidas
      FROM j12_mensalidades
      WHERE competencia = ?
      `,
      [competencia],
    );

    const [[vencido]] = await pool.query(`
      SELECT
        COALESCE(SUM(valor_atualizado), 0) AS vencido_total,
        COUNT(DISTINCT aluno_id) AS inadimplentes
      FROM j12_mensalidades
      WHERE status = 'vencido'
    `);

    return res.json({
      competencia,
      recebido_mes: Number(resumo.recebido_mes || 0),
      a_receber_mes: Number(resumo.a_receber_mes || 0),
      vencido_total: Number(vencido.vencido_total || 0),
      inadimplentes: Number(vencido.inadimplentes || 0),
      total_mensalidades_mes: Number(resumo.total_mensalidades_mes || 0),
      mensalidades_pendentes: Number(resumo.mensalidades_pendentes || 0),
      mensalidades_pagas: Number(resumo.mensalidades_pagas || 0),
      mensalidades_vencidas: Number(resumo.mensalidades_vencidas || 0),
    });
  } catch (error) {
    console.error("Erro em getResumoFinanceiro:", error);
    return res.status(500).json({
      message: "Erro ao carregar resumo financeiro.",
      error: error.message,
    });
  }
}

async function getMensalidades(req, res) {
  try {
    await ensureFinanceiroSchema();

    const user = req.auth || req.user;
    const { competencia, status, aluno_id } = req.query;

    if (user?.perfil === "professor") return forbidden(res);

    const alunoIdsPermitidos = await getAlunoIdsPermitidos(user);

    if (Array.isArray(alunoIdsPermitidos) && alunoIdsPermitidos.length === 0) {
      return res.json([]);
    }

    const params = [];
    const where = [];

    if (competencia) {
      where.push("m.competencia = ?");
      params.push(competencia);
    }

    if (status) {
      where.push("m.status = ?");
      params.push(status);
    }

    if (aluno_id) {
      where.push("m.aluno_id = ?");
      params.push(aluno_id);
    }

    if (Array.isArray(alunoIdsPermitidos)) {
      where.push(`m.aluno_id IN (${alunoIdsPermitidos.map(() => "?").join(",")})`);
      params.push(...alunoIdsPermitidos);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
      SELECT
        m.*,
        a.nome_completo AS aluno_nome,
        a.nome AS aluno_nome_alternativo,
        p.nome AS plano_nome
      FROM j12_mensalidades m
      LEFT JOIN j12_alunos a ON a.id = m.aluno_id
      LEFT JOIN j12_planos p ON p.id = m.plano_id
      ${whereSql}
      ORDER BY m.data_vencimento ASC, m.id DESC
      `,
      params,
    );

    return res.json(rows);
  } catch (error) {
    console.error("Erro em getMensalidades:", error);
    return res.status(500).json({
      message: "Erro ao listar mensalidades.",
      error: error.message,
    });
  }
}

async function gerarMensalidades(req, res) {
  try {
    await ensureFinanceiroSchema();

    const user = req.auth || req.user;

    if (!isAdmin(user)) return forbidden(res);

    const { competencia } = req.body;

    if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
      return res.status(400).json({
        message: "Competência inválida. Use o formato YYYY-MM. Exemplo: 2026-05",
      });
    }

    const [[config]] = await pool.query(
      `SELECT valor FROM j12_configuracoes_financeiras WHERE chave = 'dia_vencimento_padrao'`,
    );

    const diaPadrao = Number(config?.valor || 10);
    const [ano, mes] = competencia.split("-");
    const dataVencimentoPadrao = `${ano}-${mes}-${String(diaPadrao).padStart(2, "0")}`;

    const [alunos] = await pool.query(`
      SELECT
        a.id AS aluno_id,
        COALESCE(a.nome_completo, a.nome, CONCAT('Aluno #', a.id)) AS aluno_nome,
        a.plano_id,
        a.dia_vencimento,
        p.valor AS plano_valor,
        p.nome AS plano_nome
      FROM j12_alunos a
      INNER JOIN j12_planos p ON p.id = a.plano_id
      WHERE COALESCE(a.status, 'ativo') = 'ativo'
        AND a.plano_id IS NOT NULL
        AND p.valor IS NOT NULL
    `);

    let geradas = 0;
    let ignoradas = 0;
    const erros = [];

    for (const aluno of alunos) {
      try {
        const [[existente]] = await pool.query(
          `
          SELECT id 
          FROM j12_mensalidades
          WHERE aluno_id = ? AND competencia = ?
          LIMIT 1
          `,
          [aluno.aluno_id, competencia],
        );

        if (existente) {
          ignoradas++;
          continue;
        }

        const diaVencimento = Number(aluno.dia_vencimento || diaPadrao);
        const dataVencimento = `${ano}-${mes}-${String(diaVencimento).padStart(2, "0")}`;
        const descricao = `Mensalidade J12 - ${mes}/${ano} - ${aluno.aluno_nome}`;
        const valor = Number(aluno.plano_valor || 0);

        await pool.query(
          `
          INSERT INTO j12_mensalidades
          (
            aluno_id,
            plano_id,
            descricao,
            competencia,
            valor_original,
            valor_atualizado,
            data_vencimento,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente')
          `,
          [
            aluno.aluno_id,
            aluno.plano_id,
            descricao,
            competencia,
            valor,
            valor,
            dataVencimento || dataVencimentoPadrao,
          ],
        );

        geradas++;
      } catch (error) {
        erros.push({
          aluno_id: aluno.aluno_id,
          aluno_nome: aluno.aluno_nome,
          erro: error.message,
        });
      }
    }

    return res.json({
      message: "Processo de geração concluído.",
      total_alunos: alunos.length,
      geradas,
      ignoradas,
      erros,
    });
  } catch (error) {
    console.error("Erro em gerarMensalidades:", error);
    return res.status(500).json({
      message: "Erro ao gerar mensalidades.",
      error: error.message,
    });
  }
}

async function pagarMensalidade(req, res) {
  try {
    await ensureFinanceiroSchema();

    const user = req.auth || req.user;
    if (!isAdmin(user)) return forbidden(res);

    const { id } = req.params;
    const { valor_pago, forma_pagamento = "pix", data_pagamento, observacao } = req.body;

    const [[mensalidade]] = await pool.query(`SELECT * FROM j12_mensalidades WHERE id = ?`, [id]);

    if (!mensalidade) {
      return res.status(404).json({ message: "Mensalidade não encontrada." });
    }

    const valorPago = Number(valor_pago || mensalidade.valor_atualizado || 0);
    const valorAtualizado = Number(mensalidade.valor_atualizado || 0);
    const novoStatus = valorPago >= valorAtualizado ? "pago" : "parcial";
    const dataPagamento = data_pagamento || new Date().toISOString().slice(0, 10);

    await pool.query(
      `
      INSERT INTO j12_pagamentos
      (
        mensalidade_id,
        aluno_id,
        valor_pago,
        forma_pagamento,
        data_pagamento,
        observacao
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [id, mensalidade.aluno_id, valorPago, forma_pagamento, dataPagamento, observacao || null],
    );

    await pool.query(
      `
      UPDATE j12_mensalidades
      SET
        status = ?,
        forma_pagamento = ?,
        data_pagamento = ?,
        observacao = ?
      WHERE id = ?
      `,
      [novoStatus, forma_pagamento, dataPagamento, observacao || mensalidade.observacao, id],
    );

    return res.json({
      message:
        novoStatus === "pago" ? "Mensalidade paga com sucesso." : "Pagamento parcial registrado.",
      status: novoStatus,
    });
  } catch (error) {
    console.error("Erro em pagarMensalidade:", error);
    return res.status(500).json({
      message: "Erro ao registrar pagamento.",
      error: error.message,
    });
  }
}

async function atualizarMensalidade(req, res) {
  try {
    await ensureFinanceiroSchema();

    const user = req.auth || req.user;
    if (!isAdmin(user)) return forbidden(res);

    const { id } = req.params;

    const {
      descricao,
      valor_atualizado,
      data_vencimento,
      status,
      forma_pagamento,
      data_pagamento,
      observacao,
    } = req.body;

    await pool.query(
      `
      UPDATE j12_mensalidades
      SET
        descricao = COALESCE(?, descricao),
        valor_atualizado = COALESCE(?, valor_atualizado),
        data_vencimento = COALESCE(?, data_vencimento),
        status = COALESCE(?, status),
        forma_pagamento = COALESCE(?, forma_pagamento),
        data_pagamento = COALESCE(?, data_pagamento),
        observacao = COALESCE(?, observacao)
      WHERE id = ?
      `,
      [
        descricao ?? null,
        valor_atualizado ?? null,
        data_vencimento ?? null,
        status ?? null,
        forma_pagamento ?? null,
        data_pagamento ?? null,
        observacao ?? null,
        id,
      ],
    );

    return res.json({ message: "Mensalidade atualizada com sucesso." });
  } catch (error) {
    console.error("Erro em atualizarMensalidade:", error);
    return res.status(500).json({
      message: "Erro ao atualizar mensalidade.",
      error: error.message,
    });
  }
}

async function deletarMensalidade(req, res) {
  try {
    await ensureFinanceiroSchema();

    const user = req.auth || req.user;
    if (!isAdmin(user)) return forbidden(res);

    const { id } = req.params;

    await pool.query(`DELETE FROM j12_pagamentos WHERE mensalidade_id = ?`, [id]);
    await pool.query(`DELETE FROM j12_mensalidades WHERE id = ?`, [id]);

    return res.json({ message: "Mensalidade excluída com sucesso." });
  } catch (error) {
    console.error("Erro em deletarMensalidade:", error);
    return res.status(500).json({
      message: "Erro ao excluir mensalidade.",
      error: error.message,
    });
  }
}

module.exports = {
  getResumoFinanceiro,
  getMensalidades,
  gerarMensalidades,
  pagarMensalidade,
  atualizarMensalidade,
  deletarMensalidade,
};
