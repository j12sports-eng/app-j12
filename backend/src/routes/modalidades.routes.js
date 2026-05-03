const express = require("express");
const { canManageSystem, requireAuth } = require("../../auth");
const { pool } = require("../config/db");

const router = express.Router();

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function normalizeAtiva(value, fallback = true) {
  if (typeof value === "boolean") return value;
  const normalized = text(value, 30).toLowerCase();
  if (["inativo", "inativa", "false", "0"].includes(normalized)) return false;
  if (["ativo", "ativa", "true", "1"].includes(normalized)) return true;
  return fallback;
}

function normalizePayload(payload) {
  const nome = text(payload.nome, 191);
  if (!nome) {
    const error = new Error("Informe o nome da modalidade.");
    error.statusCode = 400;
    throw error;
  }

  return {
    nome,
    descricao: text(payload.descricao, 65535) || null,
    destaque: text(payload.destaque, 191) || null,
    ativa: normalizeAtiva(payload.ativa ?? payload.status, true),
  };
}

function mapRow(row) {
  const ativa = normalizeAtiva(row.status, true);
  return {
    id: String(row.id),
    nome: text(row.nome, 191),
    descricao: text(row.descricao, 65535),
    destaque: text(row.destaque, 191),
    ativa,
    status: ativa ? "ativo" : "inativo",
  };
}

async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM j12_modalidades WHERE id = ? LIMIT 1", [id]);
  return Array.isArray(rows) && rows.length > 0 ? mapRow(rows[0]) : null;
}

router.use(requireAuth);

router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM j12_modalidades ORDER BY nome ASC");
    res.json(Array.isArray(rows) ? rows.map(mapRow) : []);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const item = await findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Modalidade nao encontrada." });
    }

    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para criar modalidades." });
    }

    const item = normalizePayload(req.body ?? {});
    const [result] = await pool.query(
      "INSERT INTO j12_modalidades (nome, descricao, destaque, status) VALUES (?, ?, ?, ?)",
      [item.nome, item.descricao, item.destaque, item.ativa ? "ativo" : "inativo"],
    );
    res.status(201).json(await findById(result.insertId));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para editar modalidades." });
    }

    const item = normalizePayload(req.body ?? {});
    await pool.query(
      "UPDATE j12_modalidades SET nome = ?, descricao = ?, destaque = ?, status = ? WHERE id = ?",
      [item.nome, item.descricao, item.destaque, item.ativa ? "ativo" : "inativo", req.params.id],
    );

    const saved = await findById(req.params.id);
    if (!saved) {
      return res.status(404).json({ message: "Modalidade nao encontrada." });
    }

    res.json(saved);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para excluir modalidades." });
    }

    await pool.query("DELETE FROM j12_modalidades WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
