const express = require("express");
const legacyFinanceiroRoutes = require("../../routes/financeiro");
const { requireAuth, canManageSystem } = require("../../auth");
const { gerarMensalidadesDoMesAtual } = require("../services/financeiro.service");

const router = express.Router();

router.post("/gerar-mensalidades", requireAuth, async (req, res, next) => {
  try {
    const user = req.user || req.auth;
    if (!canManageSystem(user)) {
      return res.status(403).json({ message: "Acesso negado para este perfil." });
    }

    const summary = await gerarMensalidadesDoMesAtual({
      competencia: req.body?.competencia,
    });

    return res.json({
      competencia: summary.competencia,
      criadas: summary.criadas,
      existentes: summary.existentes,
      ignoradas: summary.ignoradas,
      message: `${summary.criadas} mensalidade(s) criada(s) e ${summary.existentes} ja existente(s).`,
    });
  } catch (error) {
    next(error);
  }
});

router.use("/", legacyFinanceiroRoutes);

module.exports = router;
