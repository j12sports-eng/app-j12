const express = require("express");
const { query } = require("../db");
const { requireAuth, requireRole, resolveScopedStudentId } = require("../auth");
const { parseJson } = require("./helpers");
const { loadStudentRows } = require("../src/controllers/alunos.controller");
const { listCharges } = require("../services/student-finance");

const router = express.Router();

function mapLegacyAluno(row) {
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

router.use(requireAuth);
router.use(requireRole(["aluno", "responsavel"]));

router.get("/", async (req, res, next) => {
  try {
    const studentId = resolveScopedStudentId(req.auth);
    if (!studentId) {
      return res.status(403).json({ message: "Seu usuario nao possui vinculo com um aluno." });
    }

    const baseRows = await query("SELECT * FROM j12_alunos WHERE id = ? LIMIT 1", [studentId]);

    if (Array.isArray(baseRows) && baseRows.length > 0) {
      const { rows } = await loadStudentRows();
      const portalAluno = (Array.isArray(rows) ? rows : []).find(
        (row) => String(row.id) === String(studentId),
      );

      if (!portalAluno) {
        return res.status(404).json({ message: "Aluno vinculado nao encontrado." });
      }

      const base = baseRows[0];
      return res.json({
        ...portalAluno,
        numero_matricula: base.numero_matricula ?? portalAluno.numeroMatricula ?? "",
        nome_completo: base.nome_completo ?? portalAluno.nome ?? "",
        data_nascimento: base.data_nascimento ?? portalAluno.dataNascimento ?? "",
        idade: base.idade ?? portalAluno.matricula?.dadosAluno?.idade ?? "",
        cpf: base.cpf ?? portalAluno.cpf ?? "",
        sexo: base.sexo ?? portalAluno.sexo ?? "",
        colegio: base.colegio ?? portalAluno.matricula?.dadosAluno?.colegio ?? "",
        periodo_escolar:
          base.periodo_escolar ?? portalAluno.matricula?.dadosAluno?.periodoEscolar ?? "",
        email_contato: base.email_contato ?? portalAluno.email ?? "",
        telefone_contato: base.telefone_contato ?? portalAluno.telefone ?? "",
        modalidade_principal: base.modalidade_principal ?? portalAluno.modalidade ?? "",
        turma_principal: base.turma_principal ?? portalAluno.turma ?? "",
        plano_principal: base.plano_principal ?? portalAluno.plano ?? "",
        planos_json: parseJson(base.planos_json, portalAluno.planos ?? []),
      });
    }

    const rows = await query("SELECT * FROM alunos WHERE id = ? LIMIT 1", [studentId]);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ message: "Aluno vinculado nao encontrado." });
    }

    res.json(mapLegacyAluno(rows[0]));
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

    res.json(await listCharges({ studentId }));
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
