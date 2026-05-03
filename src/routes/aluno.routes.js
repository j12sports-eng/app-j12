const express = require("express");
const router = express.Router();

// ROTAS DO ALUNO

router.get("/me", (req, res) => {
  res.json({
    id: 1,
    nome: "Aluno Teste",
  });
});

router.get("/me/financeiro", (req, res) => {
  res.json([
    {
      descricao: "Mensalidade",
      valor: 200,
      status: "pendente",
    },
  ]);
});

router.get("/me/presencas", (req, res) => {
  res.json([
    { data: "2026-05-01", status: "presente" },
  ]);
});

router.get("/me/notificacoes", (req, res) => {
  res.json([
    { mensagem: "Bem-vindo!", data: new Date() },
  ]);
});

router.get("/me/contrato", (req, res) => {
  res.json({ contrato: "Ativo" });
});

module.exports = router;