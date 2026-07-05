const express = require("express");

const { query } = require("../db.js");
const { requireAuth, requireRole, resolveScopedStudentId } = require("../auth.js");
const { parseJson } = require("./helpers.js");
const { listCharges } = require("../services/student-finance.js");
const {
  loadStudentAgenda,
  loadStudentContract,
  loadStudentDashboard,
  loadStudentDigitalCard,
  loadStudentNotifications,
  loadStudentPresence,
  loadStudentProfile,
  markStudentNotificationRead,
  updateStudentProfile,
} = require("../services/student-portal.js");

const router = express.Router();

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function number(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

async function loadStudentBase(studentId) {
  const j12Rows = await query("SELECT * FROM j12_alunos WHERE id = ? LIMIT 1", [String(studentId)]);
  const j12Student = Array.isArray(j12Rows) && j12Rows.length > 0 ? j12Rows[0] : null;

  const legacyRows = await query("SELECT * FROM alunos WHERE id = ? LIMIT 1", [String(studentId)]);
  const legacyStudent = Array.isArray(legacyRows) && legacyRows.length > 0 ? legacyRows[0] : null;

  return {
    j12Student,
    legacyStudent,
  };
}

function buildDashboardFromSources({
  studentId,
  portalAluno,
  j12Student,
  legacyStudent,
  charges,
  presencas,
}) {
  const studentName =
    text(j12Student?.nome_completo, 191) ||
    text(portalAluno?.nome, 191) ||
    text(legacyStudent?.nome, 191) ||
    "Aluno";

  const planName =
    text(j12Student?.plano_principal, 191) ||
    text(portalAluno?.plano, 191) ||
    text(legacyStudent?.plano, 191) ||
    "Sem plano";

  const orderedCharges = [...charges].sort((left, right) =>
    String(right.vencimento || "").localeCompare(String(left.vencimento || "")),
  );
  const latestCharge = orderedCharges[0] ?? null;

  const presentes = presencas.filter((item) => item.presente).length;
  const faltas = presencas.length - presentes;
  const percentual = presencas.length > 0 ? Math.round((presentes / presencas.length) * 100) : 0;

  return {
    aluno: {
      id: String(studentId),
      nome: studentName,
    },
    nome: studentName,
    financeiro: {
      mensalidade: latestCharge ? number(latestCharge.valorFinal ?? latestCharge.valor) : 0,
      status: latestCharge?.status ?? "sem_cobranca",
    },
    presenca: {
      percentual,
      presentes,
      faltas,
    },
    plano: {
      nome: planName,
    },
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

    const base = await loadStudentBase(studentId);
    const portalAluno = base.legacyStudent ? mapLegacyAluno(base.legacyStudent) : null;

    if (base.j12Student) {
      return res.json({
        ...(portalAluno || {}),
        id: String(base.j12Student.id),
        numero_matricula: base.j12Student.numero_matricula ?? portalAluno?.numeroMatricula ?? "",
        nome_completo: base.j12Student.nome_completo ?? portalAluno?.nome ?? "",
        data_nascimento: base.j12Student.data_nascimento ?? portalAluno?.dataNascimento ?? "",
        idade: base.j12Student.idade ?? portalAluno?.matricula?.dadosAluno?.idade ?? "",
        cpf: base.j12Student.cpf ?? portalAluno?.cpf ?? "",
        sexo: base.j12Student.sexo ?? portalAluno?.sexo ?? "",
        colegio: base.j12Student.colegio ?? portalAluno?.matricula?.dadosAluno?.colegio ?? "",
        periodo_escolar:
          base.j12Student.periodo_escolar ??
          portalAluno?.matricula?.dadosAluno?.periodoEscolar ??
          "",
        email_contato: base.j12Student.email_contato ?? portalAluno?.email ?? "",
        telefone_contato: base.j12Student.telefone_contato ?? portalAluno?.telefone ?? "",
        modalidade_principal: base.j12Student.modalidade_principal ?? portalAluno?.modalidade ?? "",
        turma_principal: base.j12Student.turma_principal ?? portalAluno?.turma ?? "",
        plano_principal: base.j12Student.plano_principal ?? portalAluno?.plano ?? "",
      });
    }

    if (base.legacyStudent) {
      return res.json(mapLegacyAluno(base.legacyStudent));
    }

    return res.status(404).json({ message: "Aluno vinculado nao encontrado." });
  } catch (error) {
    next(error);
  }
});

router.get("/perfil", async (req, res, next) => {
  try {
    const studentId = resolveScopedStudentId(req.auth);
    const profile = await loadStudentProfile(studentId);

    if (!profile) {
      return res.status(404).json({ message: "Aluno vinculado nao encontrado." });
    }

    return res.json(profile);
  } catch (error) {
    next(error);
  }
});

router.put("/perfil", async (req, res, next) => {
  try {
    const studentId = resolveScopedStudentId(req.auth);
    const profile = await updateStudentProfile(studentId, req.body || {});

    return res.json({
      data: profile,
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const studentId = resolveScopedStudentId(req.auth);
    res.json(await loadStudentDashboard(studentId));
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
    res.json(await loadStudentPresence(studentId));
  } catch (error) {
    next(error);
  }
});

router.get("/agenda", async (req, res, next) => {
  try {
    const studentId = resolveScopedStudentId(req.auth);
    res.json(await loadStudentAgenda(studentId, { limit: req.query?.limit }));
  } catch (error) {
    next(error);
  }
});

router.get("/contrato", async (req, res, next) => {
  try {
    const studentId = resolveScopedStudentId(req.auth);
    res.json(await loadStudentContract(studentId));
  } catch (error) {
    next(error);
  }
});

router.get("/carteirinha", async (req, res, next) => {
  try {
    const studentId = resolveScopedStudentId(req.auth);
    res.json(await loadStudentDigitalCard(studentId));
  } catch (error) {
    next(error);
  }
});

router.get("/notificacoes", async (req, res, next) => {
  try {
    const studentId = resolveScopedStudentId(req.auth);
    res.json(await loadStudentNotifications(studentId));
  } catch (error) {
    next(error);
  }
});

router.put("/notificacoes/:id/lida", async (req, res, next) => {
  try {
    const studentId = resolveScopedStudentId(req.auth);
    if (!studentId) {
      return res.status(403).json({ message: "Seu usuario nao possui vinculo com um aluno." });
    }

    const notification = await markStudentNotificationRead(studentId, req.params.id);

    res.json({
      data: notification,
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
