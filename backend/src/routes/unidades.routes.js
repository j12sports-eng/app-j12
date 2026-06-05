const express = require("express");
const { canManageSystem, requireAuth } = require("../../auth.js");
const { pool } = require("../config/db.js");

const router = express.Router();

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function normalizeAtiva(value, fallback = true) {
  const normalized = text(value, 30).toLowerCase();
  if (["inativo", "inativa", "false", "0"].includes(normalized)) return false;
  if (["ativo", "ativa", "true", "1"].includes(normalized)) return true;
  return fallback;
}

function normalizePayload(payload) {
  const nome = text(payload.nome, 191);
  if (!nome) {
    const error = new Error("Informe o nome da unidade.");
    error.statusCode = 400;
    throw error;
  }

  return {
    nome,
    endereco: text(payload.endereco, 255) || null,
    cidade: text(payload.cidade, 191) || null,
    estado: text(payload.estado, 50) || null,
    telefone: text(payload.telefone, 50) || null,
    ativa: normalizeAtiva(payload.ativa ?? payload.status, true),
  };
}

function mapRow(row) {
  const ativa = normalizeAtiva(row.status, true);
  return {
    id: String(row.id),
    nome: text(row.nome, 191),
    endereco: text(row.endereco, 255),
    cidade: text(row.cidade, 191),
    estado: text(row.estado, 50),
    telefone: text(row.telefone, 50),
    ativa,
    status: ativa ? "ativo" : "inativo",
  };
}

async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM j12_unidades WHERE id = ? LIMIT 1", [id]);
  return Array.isArray(rows) && rows.length > 0 ? mapRow(rows[0]) : null;
}

router.use(requireAuth);

router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM j12_unidades ORDER BY nome ASC");
    res.json(Array.isArray(rows) ? rows.map(mapRow) : []);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const item = await findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Unidade nao encontrada." });
    }

    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para criar unidades." });
    }

    const item = normalizePayload(req.body ?? {});
    const [result] = await pool.query(
      "INSERT INTO j12_unidades (nome, endereco, cidade, estado, telefone, status) VALUES (?, ?, ?, ?, ?, ?)",
      [
        item.nome,
        item.endereco,
        item.cidade,
        item.estado,
        item.telefone,
        item.ativa ? "ativo" : "inativo",
      ],
    );
    res.status(201).json(await findById(result.insertId));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para editar unidades." });
    }

    const item = normalizePayload(req.body ?? {});
    await pool.query(
      "UPDATE j12_unidades SET nome = ?, endereco = ?, cidade = ?, estado = ?, telefone = ?, status = ? WHERE id = ?",
      [
        item.nome,
        item.endereco,
        item.cidade,
        item.estado,
        item.telefone,
        item.ativa ? "ativo" : "inativo",
        req.params.id,
      ],
    );

    const saved = await findById(req.params.id);
    if (!saved) {
      return res.status(404).json({ message: "Unidade nao encontrada." });
    }

    res.json(saved);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para excluir unidades." });
    }

    await pool.query("DELETE FROM j12_unidades WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
