const express = require("express");

const router = express.Router();

/**
 * =========================
 * MODALIDADES
 * =========================
 */

router.get(
  "/modalidades",

  async (req, res) => {
    try {
      res.json([
        {
          id: 1,
          nome: "Futsal Kids",
          descricao: "Turma infantil",
          ativa: true,
          status: "ativo",
        },

        {
          id: 2,
          nome: "Society",
          descricao: "Turma society",
          ativa: true,
          status: "ativo",
        },
      ]);
    } catch (error) {
      console.error("Erro modalidades:", error);

      res.status(500).json({
        error: "Erro ao carregar modalidades",
      });
    }
  },
);

/**
 * =========================
 * UNIDADES
 * =========================
 */

router.get(
  "/unidades",

  async (req, res) => {
    try {
      res.json([
        {
          id: 1,
          nome: "Arena J12",
          cidade: "São Roque",
          ativa: true,
        },
      ]);
    } catch (error) {
      console.error("Erro unidades:", error);

      res.status(500).json({
        error: "Erro ao carregar unidades",
      });
    }
  },
);

/**
 * =========================
 * SETTINGS
 * =========================
 */

router.get(
  "/api/state/settings",

  async (req, res) => {
    try {
      res.json({
        tema: "dark",

        versao: "1.0.0",

        sistema: "J12 Sports Hub",
      });
    } catch (error) {
      console.error("Erro settings:", error);

      res.status(500).json({
        error: "Erro ao carregar settings",
      });
    }
  },
);

router.put(
  "/api/state/settings",

  async (req, res) => {
    try {
      console.log("⚙ Settings atualizados:", req.body);

      res.json({
        success: true,

        settings: req.body,
      });
    } catch (error) {
      console.error("Erro salvar settings:", error);

      res.status(500).json({
        error: "Erro ao salvar settings",
      });
    }
  },
);

module.exports = router;
