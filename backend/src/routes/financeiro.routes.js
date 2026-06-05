const express = require("express");
const legacyFinanceiroRoutes = require("../../routes/financeiro.js");
const { requireAuth, canManageSystem } = require("../../auth.js");
const { gerarMensalidadesDoMesAtual } = require("../services/financeiro.service.js");

const {
  getResumoFinanceiro,
  getMensalidades,
  pagarMensalidade,
  atualizarMensalidade,
  deletarMensalidade,
} = require("../controllers/financeiro.controller.js");

const { pool } = require("../config/db.js");

const router = express.Router();

/**
 * ====================================
 * ADMIN ONLY
 * ====================================
 */

function apenasAdmin(req, res, next) {
  const user = req.user || req.auth;

  if (!canManageSystem(user)) {
    return res.status(403).json({
      success: false,

      error: "Acesso negado para este perfil.",
    });
  }

  next();
}

/**
 * ====================================
 * RESUMO FINANCEIRO
 * ====================================
 */

router.get(
  "/resumo",

  requireAuth,

  apenasAdmin,

  getResumoFinanceiro,
);

/**
 * ====================================
 * LISTAR MENSALIDADES
 * ====================================
 */

router.get(
  "/mensalidades",

  requireAuth,

  async (req, res) => {
    try {
      const { competencia, status, aluno_id } = req.query;

      let sql = `
        SELECT 
          m.*,
          a.nome_completo AS aluno_nome,
          p.nome AS plano_nome
        FROM j12_mensalidades m
        LEFT JOIN j12_alunos a
          ON a.id = m.aluno_id
        LEFT JOIN j12_planos p
          ON p.id = m.plano_id
        WHERE 1 = 1
      `;

      const params = [];

      if (competencia) {
        sql += " AND m.competencia = ?";

        params.push(competencia);
      }

      if (status) {
        sql += " AND m.status = ?";

        params.push(status);
      }

      if (aluno_id) {
        sql += " AND m.aluno_id = ?";

        params.push(aluno_id);
      }

      sql += " ORDER BY m.data_vencimento ASC";

      const [rows] = await pool.query(sql, params);

      return res.json({
        success: true,

        data: rows,
      });
    } catch (error) {
      console.error("Erro ao buscar mensalidades:", error);

      return res.status(500).json({
        success: false,

        error: "Erro ao buscar mensalidades",
      });
    }
  },
);

/**
 * ====================================
 * GERAR MENSALIDADES
 * ====================================
 */

router.post(
  "/gerar-mensalidades",

  requireAuth,

  apenasAdmin,

  async (req, res, next) => {
    try {
      const summary = await gerarMensalidadesDoMesAtual({
        competencia: req.body?.competencia,
      });

      return res.json({
        success: true,

        competencia: summary.competencia,

        total_alunos: summary.total_alunos || 0,

        geradas: summary.geradas ?? summary.criadas ?? 0,

        criadas: summary.criadas ?? summary.geradas ?? 0,

        ignoradas: summary.ignoradas || 0,

        existentes: summary.existentes || 0,

        erros: summary.erros || [],

        message: `${summary.criadas ?? summary.geradas ?? 0} mensalidade(s) criada(s)`,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * ====================================
 * PAGAR
 * ====================================
 */

router.post(
  "/mensalidades/:id/pagar",

  requireAuth,

  apenasAdmin,

  pagarMensalidade,
);

/**
 * ====================================
 * EDITAR
 * ====================================
 */

router.put(
  "/mensalidades/:id",

  requireAuth,

  apenasAdmin,

  atualizarMensalidade,
);

/**
 * ====================================
 * EXCLUIR
 * ====================================
 */

router.delete(
  "/mensalidades/:id",

  requireAuth,

  apenasAdmin,

  deletarMensalidade,
);

/**
 * ====================================
 * FINANCEIRO DO ALUNO
 * ====================================
 */

router.get(
  "/aluno/me/financeiro",

  requireAuth,

  async (req, res) => {
    try {
      const user = req.user || req.auth;

      const alunoId = user?.aluno_id;

      if (!alunoId) {
        return res.status(400).json({
          success: false,

          error: "Aluno não identificado",
        });
      }

      const [mensalidades] = await pool.query(
        `
          SELECT
            id,
            valor_final,
            data_vencimento,
            status
          FROM j12_mensalidades
          WHERE aluno_id = ?
          ORDER BY data_vencimento DESC
          `,

        [alunoId],
      );

      const totalAberto = mensalidades

        .filter((m) => m.status !== "pago")

        .reduce(
          (acc, item) => acc + Number(item.valor_final || 0),

          0,
        );

      const totalPago = mensalidades

        .filter((m) => m.status === "pago")

        .reduce(
          (acc, item) => acc + Number(item.valor_final || 0),

          0,
        );

      const pendentes = mensalidades.filter((m) => m.status !== "pago").length;

      return res.json({
        success: true,

        message: "Financeiro carregado",

        data: {
          resumo: {
            total_aberto: totalAberto,

            total_pago: totalPago,

            pendentes,
          },

          mensalidades: mensalidades.map((item) => ({
            id: item.id,

            valor: Number(item.valor_final),

            vencimento: item.data_vencimento,

            status: item.status,
          })),
        },
      });
    } catch (error) {
      console.error("Erro financeiro aluno:", error);

      return res.status(500).json({
        success: false,

        error: "Erro ao carregar financeiro",
      });
    }
  },
);

/**
 * ====================================
 * ROTAS LEGADAS
 * ====================================
 */

router.use("/", legacyFinanceiroRoutes);

module.exports = router;
