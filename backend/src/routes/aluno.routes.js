const express = require("express");
const { requireAuth } = require("../../auth.js");

const {
  getMe,
  getMeAgenda,
  getMeCarteirinha,
  getMeContrato,
  getMeDashboard,
  getMeDashboardResponsavel,
  getMeFinanceiro,
  getMeNotificacoes,
  getMePerfil,
  getMePresencas,
  marcarNotificacaoComoLida,
  updateMePerfil,
} = require("../controllers/aluno.controller.js");

const router = express.Router();
const authMiddleware = requireAuth;

router.get("/me", authMiddleware, getMe);
router.get("/me/perfil", authMiddleware, getMePerfil);
router.put("/me/perfil", authMiddleware, updateMePerfil);
router.get("/me/financeiro", authMiddleware, getMeFinanceiro);
router.get("/me/presencas", authMiddleware, getMePresencas);
router.get("/me/agenda", authMiddleware, getMeAgenda);
router.get("/me/notificacoes", authMiddleware, getMeNotificacoes);
router.put("/me/notificacoes/:id/lida", authMiddleware, marcarNotificacaoComoLida);
router.get("/me/contrato", authMiddleware, getMeContrato);
router.get("/me/carteirinha", authMiddleware, getMeCarteirinha);
router.get("/me/dashboard", authMiddleware, getMeDashboard);
router.get("/me/dashboard-responsavel", authMiddleware, getMeDashboardResponsavel);

module.exports = router;
