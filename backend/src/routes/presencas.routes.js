const express = require("express");
const { randomUUID } = require("node:crypto");

const { query } = require("../config/db.js");
const { canManageSystem, requireAuth } = require("../../auth.js");

const router = express.Router();

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function canManagePresencas(user) {
  return canManageSystem(user) || user?.role === "professor" || user?.perfil === "professor";
}

function teacherId(user) {
  return text(user?.teacherId ?? user?.professor_id, 64);
}

async function assertTeacherCanAccessClass(user, turmaId) {
  if (canManageSystem(user)) return;
  const professorId = teacherId(user);
  if (!professorId) {
    throw Object.assign(new Error("Professor nao vinculado ao usuario."), { statusCode: 403 });
  }
  const rows = await query("SELECT id FROM j12_turmas WHERE id = ? AND professor_id = ? LIMIT 1", [
    turmaId,
    professorId,
  ]);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw Object.assign(new Error("Turma fora do escopo do professor."), { statusCode: 403 });
  }
}

async function assertTeacherCanAccessStudent(user, alunoId) {
  if (canManageSystem(user)) return;
  const professorId = teacherId(user);
  if (!professorId) {
    throw Object.assign(new Error("Professor nao vinculado ao usuario."), { statusCode: 403 });
  }
  const rows = await query(
    `SELECT aluno.id
     FROM j12_alunos aluno
     WHERE aluno.id = ?
       AND (
         EXISTS (
           SELECT 1 FROM j12_turmas turma
           WHERE turma.id = aluno.turma_id AND turma.professor_id = ?
         )
         OR EXISTS (
           SELECT 1
           FROM enrollments enrollment
           INNER JOIN enrollment_class_links link ON link.enrollment_id = enrollment.id
           INNER JOIN j12_turmas turma ON turma.id = link.class_id
           WHERE CAST(enrollment.student_person_id AS CHAR) = CAST(aluno.id AS CHAR)
             AND enrollment.status = 'ACTIVE' AND enrollment.deleted_at IS NULL
             AND link.status = 'ACTIVE' AND link.unlinked_at IS NULL
             AND turma.professor_id = ?
         )
       )
     LIMIT 1`,
    [alunoId, professorId, professorId],
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw Object.assign(new Error("Aluno fora do escopo do professor."), { statusCode: 403 });
  }
}

async function buildAlunoResumo(alunoId) {
  const rows = await query(
    `
      SELECT id, aluno_id, turma, modalidade, data_aula, presente, observacao
      FROM student_presencas
      WHERE aluno_id = ?
      ORDER BY data_aula DESC, id DESC
    `,
    [String(alunoId)],
  );

  const presencas = (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id,
    alunoId: row.aluno_id,
    turma: row.turma,
    modalidade: row.modalidade ?? "",
    dataAula: row.data_aula,
    observacao: row.observacao ?? "",
    presente: Boolean(row.presente),
    status: row.presente ? "presente" : "falta",
  }));

  const total = presencas.length;
  const presentes = presencas.filter((item) => item.presente).length;
  const faltas = total - presentes;
  const percentual = total > 0 ? Math.round((presentes / total) * 100) : 0;

  return {
    presentes,
    faltas,
    percentual,
    resumo: {
      total_aulas: total,
      presentes,
      faltas,
      justificadas: 0,
      percentual_presenca: percentual,
    },
    presencas,
  };
}

router.use(requireAuth);

router.get("/dashboard/:aluno_id", async (req, res, next) => {
  try {
    if (!canManagePresencas(req.auth)) {
      return res
        .status(403)
        .json({ message: "Sem permissao para consultar o dashboard de presencas." });
    }

    await assertTeacherCanAccessStudent(req.auth, req.params.aluno_id);

    const payload = await buildAlunoResumo(req.params.aluno_id);
    res.json({
      presentes: payload.presentes,
      faltas: payload.faltas,
      percentual: payload.percentual,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/ranking", async (req, res, next) => {
  try {
    if (!canManagePresencas(req.auth)) {
      return res
        .status(403)
        .json({ message: "Sem permissao para consultar o ranking de presencas." });
    }

    const professorId = teacherId(req.auth);
    if (!canManageSystem(req.auth) && !professorId) {
      return res.status(403).json({ message: "Professor nao vinculado ao usuario." });
    }
    const rows = await query(
      `
        SELECT
          aluno.id AS aluno_id,
          aluno.nome_completo AS nome,
          COUNT(presenca.id) AS total_aulas,
          SUM(CASE WHEN presenca.presente = 1 THEN 1 ELSE 0 END) AS presentes
        FROM j12_alunos aluno
        INNER JOIN j12_turmas turma ON turma.id = aluno.turma_id
        LEFT JOIN student_presencas presenca ON presenca.aluno_id = aluno.id
        WHERE (? IS NULL OR turma.professor_id = ?)
        GROUP BY aluno.id, aluno.nome_completo
        HAVING COUNT(presenca.id) > 0
        ORDER BY
          (SUM(CASE WHEN presenca.presente = 1 THEN 1 ELSE 0 END) / COUNT(presenca.id)) DESC,
          aluno.nome_completo ASC
      `,
      canManageSystem(req.auth) ? [null, null] : [professorId, professorId],
    );

    res.json(
      (Array.isArray(rows) ? rows : []).map((row) => {
        const total = Number(row.total_aulas || 0);
        const presentes = Number(row.presentes || 0);
        const percentual = total > 0 ? Math.round((presentes / total) * 100) : 0;

        return {
          alunoId: String(row.aluno_id),
          nome: text(row.nome, 191) || "Aluno",
          total,
          presentes,
          faltas: Math.max(total - presentes, 0),
          percentual,
        };
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!canManagePresencas(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para registrar presencas." });
    }

    const alunoId = text(req.body?.aluno_id ?? req.body?.alunoId, 64);
    const turmaId = text(req.body?.turma_id ?? req.body?.turmaId, 64);
    const status = text(req.body?.status, 30).toLowerCase();
    const dataAula = text(req.body?.data_aula, 32) || new Date().toISOString();

    if (!alunoId || !turmaId || !["presente", "falta"].includes(status)) {
      return res.status(400).json({
        message: "Envie aluno_id, turma_id e status valido para salvar a chamada.",
      });
    }

    await assertTeacherCanAccessClass(req.auth, turmaId);
    await assertTeacherCanAccessStudent(req.auth, alunoId);

    const normalizedDate = new Date(dataAula).toISOString().slice(0, 10);
    const turmaRows = await query("SELECT nome, modalidade FROM j12_turmas WHERE id = ? LIMIT 1", [
      turmaId,
    ]);
    const turma = Array.isArray(turmaRows) && turmaRows.length > 0 ? turmaRows[0] : null;
    const turmaNome = text(turma?.nome, 191) || turmaId;
    const modalidade = text(turma?.modalidade, 191) || null;

    const existingRows = await query(
      `
        SELECT id
        FROM student_presencas
        WHERE aluno_id = ? AND turma = ? AND data_aula = ?
        LIMIT 1
      `,
      [alunoId, turmaNome, normalizedDate],
    );
    const existingId =
      Array.isArray(existingRows) && existingRows.length > 0 ? String(existingRows[0].id) : null;
    const presente = status === "presente" ? 1 : 0;

    if (existingId) {
      await query(
        `
          UPDATE student_presencas
          SET presente = ?, observacao = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [presente, text(req.body?.observacao, 65535) || null, existingId],
      );

      return res.json({
        success: true,
        data: {
          id: existingId,
          alunoId,
          turma: turmaNome,
          modalidade,
          dataAula: normalizedDate,
          status,
        },
      });
    }

    const id = `pres-${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    await query(
      `
        INSERT INTO student_presencas (
          id,
          aluno_id,
          turma,
          modalidade,
          data_aula,
          presente,
          observacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        alunoId,
        turmaNome,
        modalidade,
        normalizedDate,
        presente,
        text(req.body?.observacao, 65535) || null,
      ],
    );

    res.status(201).json({
      success: true,
      data: {
        id,
        alunoId,
        turma: turmaNome,
        modalidade,
        dataAula: normalizedDate,
        status,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
