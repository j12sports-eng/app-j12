const express = require("express");
const { getTokenFromRequest, getUserBySessionToken, requireAuth } = require("../../auth");
const {
  getAlunos,
  getAlunoById,
  createAluno,
  updateAluno,
  deleteAluno,
} = require("../controllers/alunos.controller");

const router = express.Router();

async function optionalAuth(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return next();

    const user = await getUserBySessionToken(token);
    if (!user) {
      return res.status(401).json({ message: "Sessao invalida ou expirada." });
    }

    req.auth = user;
    req.authToken = token;
    next();
  } catch (error) {
    next(error);
  }
}

router.get("/", optionalAuth, getAlunos);
router.get("/:id", optionalAuth, getAlunoById);
router.post("/", requireAuth, createAluno);
router.put("/:id", requireAuth, updateAluno);
router.delete("/:id", requireAuth, deleteAluno);

module.exports = router;
