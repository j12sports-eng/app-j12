const { canManageSystem } = require("../../auth.js");
const { query, transaction } = require("../config/db.js");
const { loadStudentRows, normalizeAlunoPayload, persistAluno } = require("./alunos.controller.js");
const { syncStudentUsers } = require("../../services/student-users.js");
const { syncResponsavelUsers } = require("../../services/linked-users.js");
const { generateMonthlyChargeForStudent } = require("../../services/student-finance.js");

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function numeric(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function normalizeArray(values) {
  if (Array.isArray(values)) {
    return Array.from(new Set(values.map((item) => text(item, 191)).filter(Boolean)));
  }

  const normalized = String(values ?? "").trim();
  if (!normalized) return [];

  try {
    const parsed = JSON.parse(normalized);
    return Array.isArray(parsed)
      ? Array.from(new Set(parsed.map((item) => text(item, 191)).filter(Boolean)))
      : [];
  } catch {
    return Array.from(
      new Set(
        normalized
          .split(/[;,|]/g)
          .map((item) => text(item, 191))
          .filter(Boolean),
      ),
    );
  }
}

async function resolvePlano(planoId) {
  const normalized = text(planoId, 64);
  if (!normalized) return null;

  const rows = await query(
    `
      SELECT id, nome, preco_mensal, valor, modalidade, unidade
      FROM j12_planos
      WHERE id = ?
      LIMIT 1
    `,
    [normalized],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function resolveTurma(turmaId) {
  const normalized = text(turmaId, 64);
  if (!normalized) return null;

  const rows = await query(
    `
      SELECT id, nome, modalidade, unidade
      FROM j12_turmas
      WHERE id = ?
      LIMIT 1
    `,
    [normalized],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function resolveResponsavel(responsavelId) {
  const normalized = text(responsavelId, 64);
  if (!normalized) return null;

  const rows = await query(
    `
      SELECT id, nome, cpf, telefone, email, parentesco, rg
      FROM j12_responsaveis
      WHERE id = ?
      LIMIT 1
    `,
    [normalized],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function findStudentById(studentId) {
  const { rows } = await loadStudentRows({ studentId });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function criarAlunoCompleto(req, res, next) {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para cadastrar aluno." });
    }

    const payload = req.body ?? {};
    const plano = await resolvePlano(payload.planoId ?? payload.plano_id);
    const turma = await resolveTurma(payload.turmaId ?? payload.turma_id);
    const responsavel = await resolveResponsavel(payload.responsavelId ?? payload.responsavel_id);

    const modalidades = normalizeArray([
      ...(Array.isArray(payload.modalidades) ? payload.modalidades : []),
      payload.modalidade,
      turma?.modalidade,
      plano?.modalidade,
    ]);
    const turmas = normalizeArray([
      ...(Array.isArray(payload.turmas) ? payload.turmas : []),
      payload.turma,
      turma?.nome,
    ]);
    const unidades = normalizeArray([
      ...(Array.isArray(payload.unidades) ? payload.unidades : []),
      payload.unidade,
      turma?.unidade,
      plano?.unidade,
    ]);

    const diaVencimento = Number(payload.diaVencimento ?? payload.dia_vencimento ?? 10);
    const planoValor =
      numeric(
        payload.planoValor ?? payload.valor_plano ?? plano?.preco_mensal ?? plano?.valor,
        0,
      ) || null;

    const aluno = normalizeAlunoPayload({
      ...payload,
      nome: payload.nome ?? payload.nome_completo,
      email: payload.email ?? payload.email_contato,
      telefone: payload.telefone ?? payload.telefone_contato,
      responsavel: payload.responsavel ?? responsavel?.nome,
      responsavelCpf: payload.responsavelCpf ?? payload.responsavel_cpf ?? responsavel?.cpf,
      responsavelEmail: payload.responsavelEmail ?? payload.responsavel_email ?? responsavel?.email,
      responsavelRg: payload.responsavelRg ?? payload.responsavel_rg ?? responsavel?.rg,
      telefoneResponsavel:
        payload.telefoneResponsavel ??
        payload.telefone_responsavel ??
        payload.responsavel_whatsapp ??
        responsavel?.telefone,
      parentesco: payload.parentesco ?? responsavel?.parentesco,
      planoId: payload.planoId ?? payload.plano_id ?? plano?.id,
      plano: payload.plano ?? payload.plano_nome ?? plano?.nome,
      planoValor,
      turma: payload.turma ?? turma?.nome,
      modalidade: payload.modalidade ?? turma?.modalidade ?? plano?.modalidade,
      unidade: payload.unidade ?? turma?.unidade ?? plano?.unidade,
      modalidades,
      turmas,
      unidades,
      financeiro: {
        ...(typeof payload.financeiro === "object" && payload.financeiro != null
          ? payload.financeiro
          : {}),
        planoId: payload.planoId ?? payload.plano_id ?? plano?.id ?? null,
        planoNome: payload.plano ?? payload.plano_nome ?? plano?.nome ?? null,
        valorPlano: planoValor,
        diaVencimento: Number.isFinite(diaVencimento)
          ? Math.max(1, Math.min(28, diaVencimento))
          : 10,
      },
    });

    const persisted = await transaction((connection) => persistAluno(connection, aluno));
    const persistedAlunoId = persisted.id;

    await syncStudentUsers({ onlyStudentId: persistedAlunoId });
    await syncResponsavelUsers({ onlyStudentId: persistedAlunoId });

    const mensalidadeInicial = await generateMonthlyChargeForStudent(persistedAlunoId, {
      actorName: req.auth?.nome || req.auth?.email || "admin",
    });

    const saved = await findStudentById(persistedAlunoId);

    return res.status(201).json({
      ok: true,
      message: "Aluno criado com plano, vinculo e financeiro inicial.",
      aluno: saved ?? { id: persistedAlunoId },
      mensalidadeInicial,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  criarAlunoCompleto,
};
