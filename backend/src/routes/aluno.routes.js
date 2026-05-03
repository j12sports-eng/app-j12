const express = require("express");
const {
  getMe,
  getMeContrato,
  getMeFinanceiro,
  getMeNotificacoes,
  getMePresencas,
} = require("../controllers/aluno.controller");
const { requireAuth } = require("../../auth");

const router = express.Router();

router.use(requireAuth);

router.get("/me", getMe);
router.get("/me/financeiro", getMeFinanceiro);
router.get("/me/presencas", getMePresencas);
router.get("/me/notificacoes", getMeNotificacoes);
router.get("/me/contrato", getMeContrato);

module.exports = router;
