const express = require("express");

const router = express.Router();

// GET /settings
router.get("/", async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      settings: {},
    });
  } catch (error) {
    console.error("Erro settings:", error);

    return res.status(500).json({
      message: "Erro interno no servidor",
    });
  }
});

module.exports = router;
