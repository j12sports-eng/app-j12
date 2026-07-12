const express = require("express");
const db = require("../config/db.js");
const { verifyJwt } = require("../utils/jwt.js");

const router = express.Router();

router.get("/portal-aluno/presencas", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Token não enviado",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = verifyJwt(token);

    const alunoId = decoded.aluno_id;

    const [presencas] = await db.query(
      `
          SELECT
            id,
            data_aula,
            presenca,
            observacao
          FROM j12_presencas
          WHERE aluno_id = ?
          ORDER BY data_aula DESC
          `,
      [alunoId],
    );

    const total = presencas.length;

    const presentes = presencas.filter((p) => p.presenca === "presente").length;

    const percentual = total > 0 ? Math.round((presentes / total) * 100) : 0;

    res.json({
      percentual,
      total,
      presentes,
      faltas: total - presentes,
      presencas,
    });
  } catch (error) {
    console.error("Erro presencas:", error);

    res.status(500).json({
      error: "Erro ao carregar presenças",
    });
  }
});

module.exports = router;
