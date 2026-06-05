import { createRequire } from "node:module";
import jwt from "jsonwebtoken";

const backendRequire = createRequire(new URL("../../backend/package.json", import.meta.url));
const express = backendRequire("express");
const { query } = backendRequire("./db.js");

const router = express.Router();

router.get("/financeiro", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Token não informado",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Token inválido",
      });
    }

    // DECODIFICA JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const alunoId = decoded.id;

    const rows = await query(
      `
      SELECT
        id,
        descricao,
        valor,
        status,
        vencimento
      FROM j12_mensalidades
      WHERE aluno_id = ?
      ORDER BY vencimento DESC
      `,
      [alunoId],
    );

    return res.json(rows);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Erro interno no servidor",
    });
  }
});

export default router;
