const express = require("express");
const { canManageSystem, requireAuth } = require("../../auth");
const { pool } = require("../config/db");

const router = express.Router();

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function normalizePayload(payload) {
  const nome = text(payload.nome, 191);

  if (!nome) {
    const error = new Error("Informe o nome do responsavel.");

    error.statusCode = 400;

    throw error;
  }

  return {
    nome,
    cpf: text(payload.cpf, 20) || null,
    telefone: text(payload.telefone ?? payload.whatsapp, 50) || null,
    email: text(payload.email, 191) || null,
    endereco: text(payload.endereco, 255) || null,
    rg: text(payload.rg, 30) || null,
    parentesco: text(payload.parentesco, 100) || null,
  };
}

function mapRow(row) {
  return {
    id: String(row.id),
    nome: text(row.nome, 191),
    cpf: text(row.cpf, 20),
    telefone: text(row.telefone, 50),
    email: text(row.email, 191),
    endereco: text(row.endereco, 255),
    rg: text(row.rg, 30),
    parentesco: text(row.parentesco, 100),
  };
}

async function findById(id) {
  const [rows] = await pool.query(
    `
    SELECT *
    FROM j12_responsaveis
    WHERE id = ?
    LIMIT 1
    `,
    [id],
  );

  return Array.isArray(rows) && rows.length > 0 ? mapRow(rows[0]) : null;
}

router.use(requireAuth);

router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `
          SELECT *
          FROM j12_responsaveis
          ORDER BY nome ASC
          `,
    );

    res.json(Array.isArray(rows) ? rows.map(mapRow) : []);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const item = await findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        message: "Responsavel nao encontrado.",
      });
    }

    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({
        message: "Sem permissao para criar responsaveis.",
      });
    }

    const item = normalizePayload(req.body ?? {});

    const [result] = await pool.query(
      `
          INSERT INTO j12_responsaveis
          (
            nome,
            cpf,
            telefone,
            email,
            endereco,
            rg,
            parentesco
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
      [item.nome, item.cpf, item.telefone, item.email, item.endereco, item.rg, item.parentesco],
    );

    res.status(201).json(await findById(result.insertId));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({
        message: "Sem permissao para editar responsaveis.",
      });
    }

    const item = normalizePayload(req.body ?? {});

    await pool.query(
      `
        UPDATE j12_responsaveis
        SET
          nome = ?,
          cpf = ?,
          telefone = ?,
          email = ?,
          endereco = ?,
          rg = ?,
          parentesco = ?
        WHERE id = ?
        `,
      [
        item.nome,
        item.cpf,
        item.telefone,
        item.email,
        item.endereco,
        item.rg,
        item.parentesco,
        req.params.id,
      ],
    );

    const saved = await findById(req.params.id);

    if (!saved) {
      return res.status(404).json({
        message: "Responsavel nao encontrado.",
      });
    }

    res.json(saved);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({
        message: "Sem permissao para excluir responsaveis.",
      });
    }

    await pool.query(
      `
        DELETE FROM j12_responsaveis
        WHERE id = ?
        `,
      [req.params.id],
    );

    res.json({
      ok: true,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me/alunos", async (req, res, next) => {
  try {
    const responsavelId = req.auth?.id;

    if (!responsavelId) {
      return res.status(401).json({
        message: "Responsavel nao autenticado.",
      });
    }

    const [rows] = await pool.query(
      `
          SELECT
            a.id,
            a.nome
          FROM j12_responsavel_alunos ra

          INNER JOIN j12_alunos a
            ON a.id = ra.aluno_id

          WHERE ra.responsavel_id = ?
          `,
      [responsavelId],
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get("/me/financeiro", async (req, res, next) => {
  try {
    const responsavelId = req.auth?.id;

    if (!responsavelId) {
      return res.status(403).json({
        message: "Responsavel nao identificado.",
      });
    }

    const [rows] = await pool.query(
      `
          SELECT
            m.id,
            m.valor,
            m.status,
            m.vencimento,
            a.nome AS aluno_nome

          FROM j12_mensalidades m

          INNER JOIN j12_alunos a
            ON a.id = m.aluno_id

          INNER JOIN j12_responsavel_alunos ra
            ON ra.aluno_id = a.id

          WHERE ra.responsavel_id = ?

          ORDER BY m.vencimento DESC
          `,
      [responsavelId],
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get("/me/dashboard", async (req, res, next) => {
  try {
    const responsavelId = req.auth?.id;

    if (!responsavelId) {
      return res.status(401).json({
        success: false,

        error: "Responsável não autenticado.",
      });
    }

    /**
     * =========================
     * BUSCAR ALUNO
     * =========================
     */

    const [alunos] = await pool.query(
      `
          SELECT
            a.id,
            a.nome_completo
          FROM j12_responsavel_alunos ra

          INNER JOIN j12_alunos a
            ON a.id = ra.aluno_id

          WHERE ra.responsavel_id = ?

          LIMIT 1
          `,
      [responsavelId],
    );

    if (!alunos.length) {
      return res.status(404).json({
        success: false,

        error: "Nenhum aluno encontrado.",
      });
    }

    const aluno = alunos[0];

    /**
     * =========================
     * FINANCEIRO
     * =========================
     */

    const [mensalidades] = await pool.query(
      `
          SELECT
            valor,
            status
          FROM j12_mensalidades
          WHERE aluno_id = ?
          ORDER BY created_at DESC
          LIMIT 1
          `,
      [aluno.id],
    );

    let mensalidade = 0;

    let status = "sem mensalidade";

    if (mensalidades.length) {
      mensalidade = Number(mensalidades[0].valor || 0);

      status = mensalidades[0].status || "pendente";
    }

    /**
     * =========================
     * PRESENÇA
     * =========================
     */

    let percentual = 0;

    try {
      const [presencas] = await pool.query(
        `
            SELECT presente
            FROM student_presencas
            WHERE aluno_id = ?
            `,
        [aluno.id],
      );

      if (presencas.length) {
        const total = presencas.length;

        const presentes = presencas.filter((p) => p.presente === 1).length;

        percentual = Math.round((presentes / total) * 100);
      }
    } catch (err) {
      console.log("Presenças não encontradas");
    }

    /**
     * =========================
     * RESPONSE
     * =========================
     */

    return res.json({
      success: true,

      data: {
        aluno: {
          nome: aluno.nome_completo,
        },

        financeiro: {
          mensalidade,

          status,
        },

        presenca: {
          percentual,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
