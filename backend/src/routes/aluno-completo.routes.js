const express = require("express");
const { requireAuth } = require("../../auth.js");
const { criarAlunoCompleto } = require("../controllers/aluno-completo.controller.js");

const router = express.Router();

router.post("/", requireAuth, criarAlunoCompleto);

module.exports = router;
