const express = require("express");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    res.json([]);
  } catch (err) {
    console.error("Erro em /trial-classes:", err);
    res.status(500).json({
      message: "Erro interno no servidor",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Aula experimental salva com sucesso",
    });
  } catch (err) {
    console.error("Erro POST /trial-classes:", err);
    res.status(500).json({
      message: "Erro interno no servidor",
    });
  }
});

module.exports = router;
