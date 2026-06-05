const express = require("express");
const { canManageSystem, requireAuth } = require("../../auth.js");
const { pool } = require("../config/db.js");

const router = express.Router();

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function integer(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function toId(value) {
  const normalized = String(value ?? "").trim();
  return /^\d+$/.test(normalized) ? normalized : null;
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value ?? fallback;

  try {
    const parsed = JSON.parse(String(value));
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function uniqueValues(values) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function parseDiasSemana(value) {
  const arrayValue = Array.isArray(value)
    ? value
    : safeJsonParse(value, Array.isArray(value) ? value : []);

  if (Array.isArray(arrayValue) && arrayValue.length > 0) {
    return uniqueValues(arrayValue);
  }

  const raw = text(value, 191);
  if (!raw) return [];

  return uniqueValues(
    raw
      .replace(/\./g, "")
      .split(/[\/,;|]/g)
      .map((item) => item.toLowerCase()),
  );
}

function normalizeAtiva(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = text(value, 30).toLowerCase();
  if (["inativa", "inativo", "false", "0"].includes(normalized)) return false;
  if (["ativa", "ativo", "true", "1"].includes(normalized)) return true;
  return fallback;
}

function normalizeTurmaPayload(payload) {
  const nome = text(payload.nome, 191);
  if (!nome) {
    const error = new Error("Informe o nome da turma.");
    error.statusCode = 400;
    throw error;
  }

  const diasSemana = parseDiasSemana(
    payload.diasSemana ?? payload.dias_semana_json ?? payload.dias_semana,
  );
  const horarioInicio = text(
    payload.horarioInicio ?? payload.horario_inicio ?? payload.horario,
    20,
  );

  return {
    nome,
    modalidade: text(payload.modalidade, 191) || null,
    modalidadeId: toId(payload.modalidadeId ?? payload.modalidade_id),
    unidade: text(payload.unidade, 191) || null,
    unidadeId: toId(payload.unidadeId ?? payload.unidade_id),
    professorId: toId(payload.professorId ?? payload.professor_id),
    professorNome: text(payload.professor ?? payload.professor_nome, 191) || null,
    diasSemana,
    horarioInicio,
    horarioFim: text(payload.horarioFim ?? payload.horario_fim, 20) || null,
    capacidadeMaxima: integer(payload.capacidadeMaxima ?? payload.capacidade, 0),
    ativa: normalizeAtiva(payload.ativa ?? payload.status, true),
    alunoIds: uniqueValues(
      safeJsonParse(payload.alunoIds ?? payload.aluno_ids_json, []).map((item) => String(item)),
    ),
    presencas: safeJsonParse(payload.presencas ?? payload.presencas_json, []),
  };
}

function mapTurmaRow(row) {
  const diasSemana = parseDiasSemana(row.dias_semana_json ?? row.dias_semana);
  const alunoIds = uniqueValues(
    safeJsonParse(row.aluno_ids_json_resolved ?? row.aluno_ids_json, []).map((item) =>
      String(item),
    ),
  );

  return {
    id: String(row.id),
    nome: text(row.nome, 191),
    modalidade: text(row.modalidade, 191),
    unidade: text(row.unidade, 191),
    professorId: row.professor_id == null ? null : String(row.professor_id),
    professor: text(row.professor_nome_rel ?? row.professor_nome, 191),
    diasSemana,
    horarioInicio: text(row.horario_inicio ?? row.horario, 20),
    horarioFim: text(row.horario_fim, 20),
    capacidadeMaxima: integer(row.capacidade, 0),
    ativa: normalizeAtiva(row.status, true),
    alunoIds,
    presencas: safeJsonParse(row.presencas_json, []),
    criadaEm: row.created_at?.slice?.(0, 10) ?? null,
    updatedAt: row.updated_at ?? row.created_at ?? null,
    status: normalizeAtiva(row.status, true) ? "ativa" : "inativa",
  };
}

async function findTurmaById(id) {
  const [rows] = await pool.query(
    `
      SELECT
        turma.*,
        COALESCE(professor.nome, turma.professor_nome) AS professor_nome_rel,
        (
          SELECT JSON_ARRAYAGG(CAST(aluno.id AS CHAR))
          FROM j12_alunos aluno
          WHERE aluno.turma_id = turma.id OR aluno.turma_principal = turma.nome
        ) AS aluno_ids_json_resolved
      FROM j12_turmas turma
      LEFT JOIN j12_professores professor ON professor.id = turma.professor_id
      WHERE turma.id = ?
      LIMIT 1
    `,
    [id],
  );

  return Array.isArray(rows) && rows.length > 0 ? mapTurmaRow(rows[0]) : null;
}

router.use(requireAuth);

router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          turma.*,
          COALESCE(professor.nome, turma.professor_nome) AS professor_nome_rel,
          (
            SELECT JSON_ARRAYAGG(CAST(aluno.id AS CHAR))
            FROM j12_alunos aluno
            WHERE aluno.turma_id = turma.id OR aluno.turma_principal = turma.nome
          ) AS aluno_ids_json_resolved
        FROM j12_turmas turma
        LEFT JOIN j12_professores professor ON professor.id = turma.professor_id
        ORDER BY turma.nome ASC
      `,
    );

    res.json(Array.isArray(rows) ? rows.map(mapTurmaRow) : []);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const turma = await findTurmaById(req.params.id);
    if (!turma) {
      return res.status(404).json({ message: "Turma nao encontrada." });
    }

    res.json(turma);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para criar turmas." });
    }

    const turma = normalizeTurmaPayload(req.body ?? {});
    const [result] = await pool.query(
      `
        INSERT INTO j12_turmas (
          nome,
          modalidade,
          modalidade_id,
          unidade,
          unidade_id,
          professor_id,
          professor_nome,
          dias_semana,
          dias_semana_json,
          horario,
          horario_inicio,
          horario_fim,
          capacidade,
          status,
          aluno_ids_json,
          presencas_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        turma.nome,
        turma.modalidade,
        turma.modalidadeId,
        turma.unidade,
        turma.unidadeId,
        turma.professorId,
        turma.professorNome,
        turma.diasSemana.join("/"),
        JSON.stringify(turma.diasSemana),
        turma.horarioInicio || null,
        turma.horarioInicio || null,
        turma.horarioFim,
        turma.capacidadeMaxima,
        turma.ativa ? "ativa" : "inativa",
        JSON.stringify(turma.alunoIds),
        JSON.stringify(turma.presencas),
      ],
    );

    const saved = await findTurmaById(result.insertId);
    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para editar turmas." });
    }

    const turma = normalizeTurmaPayload(req.body ?? {});
    await pool.query(
      `
        UPDATE j12_turmas
        SET
          nome = ?,
          modalidade = ?,
          modalidade_id = ?,
          unidade = ?,
          unidade_id = ?,
          professor_id = ?,
          professor_nome = ?,
          dias_semana = ?,
          dias_semana_json = ?,
          horario = ?,
          horario_inicio = ?,
          horario_fim = ?,
          capacidade = ?,
          status = ?,
          aluno_ids_json = ?,
          presencas_json = ?
        WHERE id = ?
      `,
      [
        turma.nome,
        turma.modalidade,
        turma.modalidadeId,
        turma.unidade,
        turma.unidadeId,
        turma.professorId,
        turma.professorNome,
        turma.diasSemana.join("/"),
        JSON.stringify(turma.diasSemana),
        turma.horarioInicio || null,
        turma.horarioInicio || null,
        turma.horarioFim,
        turma.capacidadeMaxima,
        turma.ativa ? "ativa" : "inativa",
        JSON.stringify(turma.alunoIds),
        JSON.stringify(turma.presencas),
        req.params.id,
      ],
    );

    const saved = await findTurmaById(req.params.id);
    if (!saved) {
      return res.status(404).json({ message: "Turma nao encontrada." });
    }

    res.json(saved);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para excluir turmas." });
    }

    await pool.query("DELETE FROM j12_turmas WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
