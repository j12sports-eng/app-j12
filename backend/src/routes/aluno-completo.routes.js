const express = require("express");
const { requireAuth } = require("../../auth");
const { criarAlunoCompleto } = require("../controllers/aluno-completo.controller");

const router = express.Router();

router.post("/", requireAuth, criarAlunoCompleto);

module.exports = router;
