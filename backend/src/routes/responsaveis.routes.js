const express = require("express");
const { canManageSystem, requireAuth } = require("../../auth");
const { pool } = require("../config/db");

const router = express.Router();

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function normalizePayload(payload) {
  const nome = text(payload.nome, 191);
  if (!nome) {
    const error = new Error("Informe o nome do responsavel.");
    error.statusCode = 400;
    throw error;
  }

  return {
    nome,
    cpf: text(payload.cpf, 20) || null,
    telefone: text(payload.telefone ?? payload.whatsapp, 50) || null,
    email: text(payload.email, 191) || null,
    endereco: text(payload.endereco, 255) || null,
    rg: text(payload.rg, 30) || null,
    parentesco: text(payload.parentesco, 100) || null,
  };
}

function mapRow(row) {
  return {
    id: String(row.id),
    nome: text(row.nome, 191),
    cpf: text(row.cpf, 20),
    telefone: text(row.telefone, 50),
    email: text(row.email, 191),
    endereco: text(row.endereco, 255),
    rg: text(row.rg, 30),
    parentesco: text(row.parentesco, 100),
  };
}

async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM j12_responsaveis WHERE id = ? LIMIT 1", [id]);
  return Array.isArray(rows) && rows.length > 0 ? mapRow(rows[0]) : null;
}

router.use(requireAuth);

router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM j12_responsaveis ORDER BY nome ASC");
    res.json(Array.isArray(rows) ? rows.map(mapRow) : []);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const item = await findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Responsavel nao encontrado." });
    }

    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para criar responsaveis." });
    }

    const item = normalizePayload(req.body ?? {});
    const [result] = await pool.query(
      "INSERT INTO j12_responsaveis (nome, cpf, telefone, email, endereco, rg, parentesco) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [item.nome, item.cpf, item.telefone, item.email, item.endereco, item.rg, item.parentesco],
    );
    res.status(201).json(await findById(result.insertId));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para editar responsaveis." });
    }

    const item = normalizePayload(req.body ?? {});
    await pool.query(
      "UPDATE j12_responsaveis SET nome = ?, cpf = ?, telefone = ?, email = ?, endereco = ?, rg = ?, parentesco = ? WHERE id = ?",
      [
        item.nome,
        item.cpf,
        item.telefone,
        item.email,
        item.endereco,
        item.rg,
        item.parentesco,
        req.params.id,
      ],
    );

    const saved = await findById(req.params.id);
    if (!saved) {
      return res.status(404).json({ message: "Responsavel nao encontrado." });
    }

    res.json(saved);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para excluir responsaveis." });
    }

    await pool.query("DELETE FROM j12_responsaveis WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
