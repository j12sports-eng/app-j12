const express = require("express");

const db = require("../config/db");

const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

/**
 * =====================================
 * DASHBOARD REAL DO ALUNO
 * =====================================
 */

router.get(
  "/portal-aluno/dashboard/:aluno_id",

  authMiddleware,

  async (req, res, next) => {
    try {
      const { aluno_id } = req.params;

      const alunoId = aluno_id;

      console.log("ALUNO_ID:", alunoId);

      /*
      =========================
      ALUNO
      =========================
      */

      const alunos = await db.query(
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

      if (!alunos.length) {
        return res.status(404).json({
          success: false,

          error: "Aluno não encontrado",
        });
      }

      const aluno = alunos[0];

      /*
      =========================
      MENSALIDADE
      =========================
      */

      const mensalidades = await db.query(
        `
          SELECT
            valor,
            status
          FROM j12_mensalidades
          WHERE aluno_id = ?
          ORDER BY created_at DESC
          LIMIT 1
          `,

        [alunoId],
      );

      let mensalidade = 0;

      let statusFinanceiro = "pendente";

      if (mensalidades.length) {
        mensalidade = Number(mensalidades[0].valor || 0);

        statusFinanceiro = mensalidades[0].status || "pendente";
      }

      /*
      =========================
      PRESENÇAS
      =========================
      */

      let percentual = 0;

      let presentes = 0;

      let faltas = 0;

      try {
        const presencas = await db.query(
          `
            SELECT
              status
            FROM j12_presencas
            WHERE aluno_id = ?
            `,

          [alunoId],
        );

        if (presencas.length) {
          const total = presencas.length;

          presentes = presencas.filter((p) => p.status === "presente").length;

          faltas = total - presentes;

          percentual = Math.round((presentes / total) * 100);
        }
      } catch (err) {
        console.log("Presenças não encontradas");
      }

      /*
      =========================
      RESPONSE
      =========================
      */

      return res.json({
        aluno: {
          id: aluno.id,

          nome: aluno.nome_completo,
        },

        financeiro: {
          mensalidade,

          status: statusFinanceiro,
        },

        presenca: {
          percentual,

          presentes,

          faltas,
        },

        plano: {
          nome: aluno.modalidade_principal || "Sem modalidade",
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * =====================================
 * DEBUG COLUNAS
 * =====================================
 */

router.get(
  "/debug/alunos-columns",

  async (req, res, next) => {
    try {
      const columns = await db.query("SHOW COLUMNS FROM j12_alunos");

      return res.json({
        success: true,

        data: columns,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * =====================================
 * PERFIL DO ALUNO
 * =====================================
 */

router.get(
  "/aluno/me/perfil",

  authMiddleware,

  async (req, res) => {
    try {
      const decoded = req.user;

      const alunoId = decoded.aluno_id;

      const alunos = await db.query(
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

      if (!alunos.length) {
        return res.status(404).json({
          success: false,

          error: "Aluno não encontrado",
        });
      }

      return res.json({
        success: true,

        data: alunos[0],
      });
    } catch (error) {
      console.error("Erro perfil aluno:", error);

      return res.status(500).json({
        success: false,

        error: "Erro ao carregar perfil",
      });
    }
  },
);

/**
 * =====================================
 * PRESENÇAS DO ALUNO
 * =====================================
 */

router.get(
  "/aluno/me/presencas",

  authMiddleware,

  async (req, res) => {
    try {
      const decoded = req.user;

      const alunoId = decoded.aluno_id;

      const presencas = await db.query(
        `
          SELECT
  id,
  status,
  data_aula
FROM j12_presencas
          WHERE aluno_id = ?
          ORDER BY created_at DESC
          `,

        [alunoId],
      );

      const total = presencas.length;

      const presentes = presencas.filter((p) => p.status === "presente").length;

      const percentual = total > 0 ? Math.round((presentes / total) * 100) : 0;

      return res.json({
        success: true,

        data: {
          percentual,

          total_aulas: total,

          presentes,

          faltas: total - presentes,

          historico: presencas.map((item) => ({
            id: item.id,

            status: item.status,

            data: item.data_aula,
          })),
        },
      });
    } catch (error) {
      console.error("Erro presenças:", error);

      return res.status(500).json({
        success: false,

        error: "Erro ao carregar presenças",
      });
    }
  },
);

/**
 * =====================================
 * MARCAR NOTIFICAÇÃO COMO LIDA
 * =====================================
 */

router.put(
  "/aluno/me/notificacoes/:id/lida",

  authMiddleware,

  async (req, res) => {
    try {
      const { id } = req.params;

      await db.query(
        `
        UPDATE j12_notificacoes
        SET lida = 1
        WHERE id = ?
        `,

        [id],
      );

      return res.json({
        success: true,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,

        error: "Erro ao marcar notificação",
      });
    }
  },
);

module.exports = router;
