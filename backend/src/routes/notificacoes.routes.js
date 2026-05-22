const express = require("express");

const { requireAuth } = require("../../auth");

const { pool } = require("../config/db");

const router = express.Router();

/**
 * ====================================
 * NOTIFICACOES DO ALUNO
 * ====================================
 */

router.get(
  "/aluno/me/notificacoes",

  requireAuth,

  async (req, res) => {
    try {
      const user = req.user || req.auth;

      const alunoId = user?.aluno_id;

      console.log("ALUNO NOTIFICACOES:", alunoId);

      if (!alunoId) {
        return res.status(400).json({
          message: "Aluno não identificado.",
        });
      }

      const [rows] = await pool.query(
        `
          SELECT
            id,
            titulo,
            mensagem,
            tipo,
            lida,
            created_at
          FROM j12_notificacoes
          WHERE aluno_id = ?
          ORDER BY created_at DESC
          `,

        [alunoId],
      );

      console.log("NOTIFICACOES:", rows);

      return res.json(rows);
    } catch (error) {
      console.error("Erro notificacoes:", error);

      return res.status(500).json({
        message: "Erro ao carregar notificações.",

        error: error.message,
      });
    }
  },
);

module.exports = router;
