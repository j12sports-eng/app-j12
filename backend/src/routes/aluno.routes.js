const express = require("express");
const jwt = require("jsonwebtoken");

const {
  getMe,
  getMeContrato,
  getMeFinanceiro,
  getMeNotificacoes,
  getMePresencas,
  getMeDashboard,
  getMeDashboardResponsavel,
  marcarNotificacaoComoLida,
} = require("../controllers/aluno.controller");

const router = express.Router();

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Token não informado",
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    console.error("ERRO AUTH:", error.message);

    return res.status(401).json({
      error: "Token inválido",
    });
  }
}

// ================= ROTAS =================

router.get("/me", authMiddleware, getMe);

router.get("/me/financeiro", authMiddleware, getMeFinanceiro);

router.get("/me/presencas", authMiddleware, getMePresencas);

router.get("/me/notificacoes", authMiddleware, getMeNotificacoes);

router.put("/me/notificacoes/:id/lida", authMiddleware, marcarNotificacaoComoLida);

router.get("/me/contrato", authMiddleware, getMeContrato);

router.get("/me/dashboard", authMiddleware, getMeDashboard);

router.get("/me/dashboard-responsavel", authMiddleware, getMeDashboardResponsavel);

module.exports = router;
