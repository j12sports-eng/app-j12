const express = require("express");
const { canManageSystem, requireAuth } = require("../../auth.js");
const alunosController = require("../controllers/alunos.controller.js");
const { pool } = require("../config/db.js");

const router = express.Router();

function ensureManagementAccess(req, res, next) {
  if (canManageSystem(req.auth)) {
    next();
    return;
  }

  res.status(403).json({
    message: "Sem permissao para alterar alunos.",
  });
}

function safeHandler(handler, name) {
  return async function (req, res, next) {
    try {
      if (typeof handler !== "function") {
        return res.status(500).json({
          message: `Handler ${name} não foi encontrado no alunos.controller.js`,
        });
      }

      return await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

router.use(requireAuth);

router.get("/", safeHandler(alunosController.getAlunos, "getAlunos"));
// COMENTE ESSA LINHA POR ENQUANTO
// router.get("/:id", safeHandler(alunosController.getAlunoById, "getAlunoById"));
router.post("/", ensureManagementAccess, safeHandler(alunosController.createAluno, "createAluno"));
router.put(
  "/:id",
  ensureManagementAccess,
  safeHandler(alunosController.updateAluno, "updateAluno"),
);
router.delete(
  "/:id",
  ensureManagementAccess,
  safeHandler(alunosController.deleteAluno, "deleteAluno"),
);

/**
 * ==========================
 * ALUNOS POR TURMA
 * ==========================
 */

router.get("/turma/:id", async (req, res) => {
  try {
    const { id: turmaId } = req.params;

    const [alunos] = await pool.query(
      `
        SELECT
          id,
          nome_completo AS nome
        FROM j12_alunos
        WHERE turma_id = ?
           OR turma_principal = (
             SELECT nome
             FROM j12_turmas
             WHERE id = ?
             LIMIT 1
           )
        ORDER BY nome_completo ASC
      `,
      [turmaId, turmaId],
    );

    res.json(alunos);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Erro ao listar alunos da turma",
    });
  }
});

module.exports = router;
