const express = require("express");

const router = express.Router();

const {
  getDashboardFinanceiro,
  criarReceita,
  listarReceitas,
  criarDespesa,
  listarDespesas,
  listarPix,
  criarMensalidade,
  listarMensalidadesAluno,
  pagarMensalidade,
  gerarMensalidades,
  getMensalidades,
  getResumoFinanceiro,
} = require("../controllers/financeiro.controller");

router.get("/dashboard", getDashboardFinanceiro);

router.post("/receitas", criarReceita);
router.get("/receitas", listarReceitas);

router.post("/despesas", criarDespesa);
router.get("/despesas", listarDespesas);

router.get("/pix", listarPix);

router.post("/mensalidades", criarMensalidade);

router.get("/mensalidades/:alunoId", listarMensalidadesAluno);

router.put("/mensalidades/:id/pagar", pagarMensalidade);

router.get("/resumo", getResumoFinanceiro);

router.get("/mensalidades", getMensalidades);

router.post("/mensalidades/gerar", gerarMensalidades);

module.exports = router;
