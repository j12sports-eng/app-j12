const express = require("express");

const router = express.Router();

// GET /contratos
router.get("/", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error("Erro contratos:", error);

    res.status(500).json({
      success: false,
      message: "Erro ao buscar contratos",
    });
  }
});

module.exports = router;
