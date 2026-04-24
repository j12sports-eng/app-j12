const express = require("express");
const { query } = require("../db");
const { requireAuth, requireRole, resolveScopedStudentId } = require("../auth");
const { parseJson } = require("./helpers");

const router = express.Router();

function mapAluno(row) {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email ?? "",
    telefone: row.telefone ?? "",
    fotoUrl: row.foto_url ?? "",
    dataNascimento: row.data_nascimento ?? "",
    responsavel: row.responsavel ?? "",
    responsavelCpf: row.responsavel_cpf ?? "",
    responsavelEmail: row.responsavel_email ?? "",
    responsavelWhatsapp: row.responsavel_whatsapp ?? "",
    modalidade: row.modalidade ?? "",
    unidades: parseJson(row.unidades_json, []),
    turmas: parseJson(row.turmas_json, []),
    planos: parseJson(row.planos_json, []),
    horarios: parseJson(row.horarios_json, []),
    turma: row.turma ?? "",
    plano: row.plano ?? "",
    status: row.status ?? "ativo",
    matriculaEm: row.matricula_em ?? "",
    numeroMatricula: row.numero_matricula ?? "",
    cpf: row.cpf ?? "",
    rg: row.rg ?? "",
    sexo: row.sexo ?? "",
    matricula: parseJson(row.matricula_json, null),
    financeiro: parseJson(row.financeiro_json, null),
  };
}

function mapFinanceiro(row) {
  return {
    id: row.id,
    alunoId: row.aluno_id,
    alunoNome: row.aluno_nome,
    descricao: row.descricao,
    valor: Number(row.valor_final ?? row.valor ?? 0),
    valorOriginal: Number(row.valor_original ?? row.valor ?? 0),
    descontoValor: Number(row.desconto_valor ?? 0),
    descontoPercentual: Number(row.desconto_percentual ?? 0),
    bolsaValor: Number(row.bolsa_valor ?? 0),
    bolsaPercentual: Number(row.bolsa_percentual ?? 0),
    multaPercentual: Number(row.multa_percentual ?? 0),
    jurosDiaPercentual: Number(row.juros_dia_percentual ?? 0),
    vencimento: row.vencimento,
    pagoEm: row.pago_em,
    dataGeracao: row.data_geracao,
    dataPagamento: row.data_pagamento,
    status: row.status,
    tipoCobranca: row.tipo_cobranca,
    origem: row.origem,
    formaPagamento: row.forma_pagamento,
    planoNome: row.plano_nome,
    periodicidade: row.periodicidade,
    competencia: row.competencia,
    observacao: row.observacao,
  };
}

router.use(requireAuth);
router.use(requireRole(["aluno", "responsavel"]));

router.get("/", async (req, res, next) => {
  try {
    const studentId = resolveScopedStudentId(req.auth);
    if (!studentId) {
      return res.status(403).json({ message: "Seu usuario nao possui vinculo com um aluno." });
    }

    const rows = await query("SELECT * FROM alunos WHERE id = ? LIMIT 1", [studentId]);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ message: "Aluno vinculado nao encontrado." });
    }

    res.json(mapAluno(rows[0]));
  } catch (error) {
    next(error);
  }
});

router.get("/financeiro", async (req, res, next) => {
  try {
    const studentId = resolveScopedStudentId(req.auth);
    if (!studentId) {
      return res.status(403).json({ message: "Seu usuario nao possui vinculo com um aluno." });
    }

    const rows = await query(
      "SELECT * FROM financeiro WHERE aluno_id = ? ORDER BY vencimento DESC, updated_at DESC",
      [studentId],
    );

    res.json((Array.isArray(rows) ? rows : []).map(mapFinanceiro));
  } catch (error) {
    next(error);
  }
});

router.get("/presencas", async (req, res, next) => {
  try {
    const studentId = resolveScopedStudentId(req.auth);
    if (!studentId) {
      return res.status(403).json({ message: "Seu usuario nao possui vinculo com um aluno." });
    }

    const rows = await query(
      `
        SELECT id, aluno_id, turma, modalidade, data_aula, presente, observacao
        FROM student_presencas
        WHERE aluno_id = ?
        ORDER BY data_aula DESC
      `,
      [studentId],
    );

    res.json(
      (Array.isArray(rows) ? rows : []).map((row) => ({
        id: row.id,
        alunoId: row.aluno_id,
        turma: row.turma,
        modalidade: row.modalidade ?? "",
        dataAula: row.data_aula,
        presente: Boolean(row.presente),
        observacao: row.observacao ?? "",
      })),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/contrato", async (req, res, next) => {
  try {
    const studentId = resolveScopedStudentId(req.auth);
    if (!studentId) {
      return res.status(403).json({ message: "Seu usuario nao possui vinculo com um aluno." });
    }

    const rows = await query(
      `
        SELECT *
        FROM student_contracts
        WHERE aluno_id = ?
        ORDER BY data_emissao DESC, updated_at DESC
        LIMIT 1
      `,
      [studentId],
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.json(null);
    }

    const row = rows[0];
    res.json({
      id: row.id,
      alunoId: row.aluno_id,
      tipoDocumento: row.tipo_documento,
      titulo: row.titulo,
      status: row.status,
      arquivoPdf: row.arquivo_pdf ?? null,
      templateHtml: row.template_html ?? "",
      dataEmissao: row.data_emissao ?? null,
      dataAssinatura: row.data_assinatura ?? null,
      observacoes: row.observacoes ?? "",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/notificacoes", async (req, res, next) => {
  try {
    const studentId = resolveScopedStudentId(req.auth);
    if (!studentId) {
      return res.status(403).json({ message: "Seu usuario nao possui vinculo com um aluno." });
    }

    const rows = await query(
      `
        SELECT *
        FROM student_notifications
        WHERE aluno_id = ?
        ORDER BY created_at DESC, updated_at DESC
      `,
      [studentId],
    );

    res.json(
      (Array.isArray(rows) ? rows : []).map((row) => ({
        id: row.id,
        alunoId: row.aluno_id,
        titulo: row.titulo,
        mensagem: row.mensagem,
        canal: row.canal,
        tipo: row.tipo,
        lida: Boolean(row.lida),
        createdAt: row.created_at,
      })),
    );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
