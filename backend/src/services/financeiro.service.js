const { query, tableExists, transaction } = require("../config/db");

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function numeric(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function currentCompetencia(referenceDate = new Date()) {
  return referenceDate.toISOString().slice(0, 7);
}

function normalizeCompetencia(value) {
  const normalized = text(value, 7);
  if (/^\d{4}-\d{2}$/.test(normalized)) return normalized;
  return currentCompetencia();
}

function buildDueDate(competencia, dueDay = 10) {
  const [year, month] = competencia.split("-").map(Number);
  const date = new Date(year, month - 1, Math.max(1, Math.min(28, Number(dueDay) || 10)));
  return date.toISOString().slice(0, 10);
}

function buildChargeId(alunoId, competencia, planoId) {
  return `cob-j12-${alunoId}-${competencia}-${planoId || "sem-plano"}`;
}

async function loadAlunoFinanceiroData(connection, alunoId) {
  const [rows] = await connection.execute(
    `
      SELECT
        aluno.id,
        aluno.numero_matricula,
        aluno.nome_completo,
        aluno.email_contato,
        aluno.telefone_contato,
        aluno.status,
        aluno.plano_id,
        aluno.turma_id,
        aluno.responsavel_id,
        plano.nome AS plano_nome,
        COALESCE(plano.valor, plano.preco_mensal, aluno.plano_valor, 0) AS plano_valor,
        turma.nome AS turma_nome,
        turma.modalidade AS turma_modalidade,
        turma.unidade AS turma_unidade,
        responsavel.nome AS responsavel_nome,
        responsavel.cpf AS responsavel_cpf,
        responsavel.telefone AS responsavel_telefone,
        responsavel.email AS responsavel_email
      FROM j12_alunos aluno
      LEFT JOIN j12_planos plano ON plano.id = aluno.plano_id
      LEFT JOIN j12_turmas turma ON turma.id = aluno.turma_id
      LEFT JOIN j12_responsaveis responsavel ON responsavel.id = aluno.responsavel_id
      WHERE aluno.id = ?
      LIMIT 1
    `,
    [Number(alunoId)],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function findMensalidadeDoAluno(connection, alunoId, competencia) {
  const [rows] = await connection.execute(
    `
      SELECT *
      FROM j12_mensalidades
      WHERE aluno_id = ? AND referencia = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [Number(alunoId), competencia],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function upsertFinanceiroChargeMirror(connection, aluno, competencia, valor, vencimento) {
  if (!(await tableExists("j12_financeiro_cobrancas"))) {
    return null;
  }

  const chargeId = buildChargeId(aluno.id, competencia, aluno.plano_id);
  await connection.execute(
    `
      INSERT INTO j12_financeiro_cobrancas (
        id,
        aluno_id,
        numero_matricula,
        nome_aluno,
        competencia,
        descricao,
        tipo,
        valor,
        vencimento,
        status,
        origem,
        periodicidade,
        plano_id,
        plano_nome,
        modalidade,
        turma,
        unidade,
        responsavel_financeiro,
        responsavel_cpf,
        telefone_whatsapp,
        email,
        observacao,
        data_geracao,
        valor_original,
        desconto_valor,
        desconto_percentual,
        bolsa_valor,
        bolsa_percentual,
        multa_percentual,
        juros_dia_percentual,
        valor_final,
        tipo_cobranca,
        ativo,
        alterado_por
      ) VALUES (?, ?, ?, ?, ?, ?, 'mensalidade', ?, ?, 'pendente', 'automatico', 'mensal', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, CURDATE(), ?, 0, 0, 0, 0, 0, 0, ?, 'recorrente', 1, 'financeiro.service')
      ON DUPLICATE KEY UPDATE
        numero_matricula = VALUES(numero_matricula),
        nome_aluno = VALUES(nome_aluno),
        competencia = VALUES(competencia),
        descricao = VALUES(descricao),
        valor = VALUES(valor),
        vencimento = VALUES(vencimento),
        status = CASE WHEN j12_financeiro_cobrancas.status = 'pago' THEN j12_financeiro_cobrancas.status ELSE VALUES(status) END,
        plano_id = VALUES(plano_id),
        plano_nome = VALUES(plano_nome),
        modalidade = VALUES(modalidade),
        turma = VALUES(turma),
        unidade = VALUES(unidade),
        responsavel_financeiro = VALUES(responsavel_financeiro),
        responsavel_cpf = VALUES(responsavel_cpf),
        telefone_whatsapp = VALUES(telefone_whatsapp),
        email = VALUES(email),
        data_geracao = VALUES(data_geracao),
        valor_original = VALUES(valor_original),
        valor_final = VALUES(valor_final),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      chargeId,
      Number(aluno.id),
      text(aluno.numero_matricula, 50) || null,
      text(aluno.nome_completo, 191) || "Aluno",
      competencia,
      `Mensalidade ${competencia} - ${text(aluno.plano_nome, 191) || "Plano J12"}`,
      valor,
      vencimento,
      aluno.plano_id ? Number(aluno.plano_id) : null,
      text(aluno.plano_nome, 191) || null,
      text(aluno.turma_modalidade, 191) || null,
      text(aluno.turma_nome, 191) || null,
      text(aluno.turma_unidade, 191) || null,
      text(aluno.responsavel_nome, 191) || null,
      text(aluno.responsavel_cpf, 20) || null,
      text(aluno.responsavel_telefone || aluno.telefone_contato, 50) || null,
      text(aluno.responsavel_email || aluno.email_contato, 191) || null,
      valor,
      valor,
    ],
  );

  return chargeId;
}

async function gerarMensalidadeDoAluno(alunoId, options = {}) {
  const competencia = normalizeCompetencia(options.competencia);

  return transaction(async (connection) => {
    const aluno = await loadAlunoFinanceiroData(connection, alunoId);
    if (!aluno) {
      const error = new Error("Aluno nao encontrado.");
      error.statusCode = 404;
      throw error;
    }

    if (text(aluno.status, 30).toLowerCase() !== "ativo") {
      return {
        created: false,
        existed: false,
        skippedReason: "aluno_inativo",
        competencia,
      };
    }

    if (!aluno.plano_id) {
      return {
        created: false,
        existed: false,
        skippedReason: "sem_plano",
        competencia,
      };
    }

    const valor = numeric(aluno.plano_valor, 0);
    if (valor <= 0) {
      return {
        created: false,
        existed: false,
        skippedReason: "plano_sem_valor",
        competencia,
      };
    }

    const existingMensalidade = await findMensalidadeDoAluno(connection, aluno.id, competencia);
    if (existingMensalidade) {
      return {
        created: false,
        existed: true,
        skippedReason: "duplicado",
        competencia,
        mensalidadeId: existingMensalidade.id,
        cobrancaId: existingMensalidade.cobranca_id || null,
      };
    }

    const vencimento = buildDueDate(competencia, 10);
    const cobrancaId = await upsertFinanceiroChargeMirror(
      connection,
      aluno,
      competencia,
      valor,
      vencimento,
    );

    const [result] = await connection.execute(
      `
        INSERT INTO j12_mensalidades (
          aluno_id,
          plano_id,
          turma_id,
          referencia,
          valor,
          desconto,
          multa,
          juros,
          valor_final,
          data_vencimento,
          status,
          forma_pagamento,
          observacoes,
          cobranca_id,
          turma,
          observacao
        ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 'pendente', NULL, NULL, ?, ?, NULL)
      `,
      [
        Number(aluno.id),
        aluno.plano_id ? Number(aluno.plano_id) : null,
        aluno.turma_id ? Number(aluno.turma_id) : null,
        competencia,
        valor,
        valor,
        vencimento,
        cobrancaId || buildChargeId(aluno.id, competencia, aluno.plano_id),
        text(aluno.turma_nome, 191) || null,
      ],
    );

    return {
      created: true,
      existed: false,
      skippedReason: null,
      competencia,
      mensalidadeId: Number(result?.insertId || 0) || null,
      cobrancaId: cobrancaId || buildChargeId(aluno.id, competencia, aluno.plano_id),
    };
  });
}

async function gerarMensalidadesDoMesAtual(options = {}) {
  const competencia = normalizeCompetencia(options.competencia);
  const alunos = await query(`
    SELECT id
    FROM j12_alunos
    WHERE LOWER(COALESCE(status, 'ativo')) = 'ativo'
      AND plano_id IS NOT NULL
    ORDER BY nome_completo ASC
  `);

  const summary = {
    competencia,
    criadas: 0,
    existentes: 0,
    ignoradas: 0,
  };

  for (const aluno of Array.isArray(alunos) ? alunos : []) {
    const result = await gerarMensalidadeDoAluno(aluno.id, { competencia });
    if (result.created) {
      summary.criadas += 1;
      continue;
    }
    if (result.existed) {
      summary.existentes += 1;
      continue;
    }
    summary.ignoradas += 1;
  }

  return summary;
}

module.exports = {
  gerarMensalidadeDoAluno,
  gerarMensalidadesDoMesAtual,
};
