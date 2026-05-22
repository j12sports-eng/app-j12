const express = require("express");

const { requireAuth } = require("../../auth");

const { pool } = require("../config/db");

const router = express.Router();

/**
 * ====================================
 * PERFIL DO ALUNO
 * ====================================
 */

router.get(
  "/aluno/me/perfil",

  requireAuth,

  async (req, res) => {
    try {
      const user = req.user || req.auth;

      const alunoId = user?.aluno_id;

      if (!alunoId) {
        return res.status(400).json({
          message: "Aluno não identificado.",
        });
      }

      const [rows] = await pool.query(
        `
          SELECT
            id,
            nome_completo,
            email_contato,
            telefone_contato,
            modalidade_principal,
            status
          FROM j12_alunos
          WHERE id = ?
          LIMIT 1
          `,

        [alunoId],
      );

      if (!rows.length) {
        return res.status(404).json({
          message: "Aluno não encontrado.",
        });
      }

      return res.json(rows[0]);
    } catch (error) {
      console.error("Erro perfil:", error);

      return res.status(500).json({
        message: "Erro ao carregar perfil.",

        error: error.message,
      });
    }
  },
);

/**
 * ====================================
 * ATUALIZAR PERFIL
 * ====================================
 */

router.put(
  "/aluno/me/perfil",

  requireAuth,

  async (req, res) => {
    try {
      const user = req.user || req.auth;

      const alunoId = user?.aluno_id;

      const { telefone_contato, email_contato } = req.body;

      await pool.query(
        `
        UPDATE j12_alunos
        SET
          telefone_contato = ?,
          email_contato = ?
        WHERE id = ?
        `,

        [telefone_contato, email_contato, alunoId],
      );

      return res.json({
        success: true,
      });
    } catch (error) {
      console.error("Erro atualizar perfil:", error);

      return res.status(500).json({
        message: "Erro ao atualizar perfil.",

        error: error.message,
      });
    }
  },
);



// rotas...

module.exports = router;