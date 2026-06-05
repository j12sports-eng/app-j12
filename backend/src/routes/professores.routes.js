const express = require("express");
const { canManageSystem, requireAuth } = require("../../auth.js");
const { pool } = require("../config/db.js");
const { deactivateProfessorUsers, syncProfessorUsers } = require("../../services/linked-users.js");

const router = express.Router();

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function numeric(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value ?? fallback;

  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function uniqueValues(values) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function normalizeStatus(value) {
  const normalized = text(value, 30).toLowerCase();
  if (normalized === "ferias" || normalized === "férias") return "férias";
  if (normalized === "inativo") return "inativo";
  return "ativo";
}

function normalizePayload(payload) {
  const nome = text(payload.nome, 191);
  if (!nome) {
    const error = new Error("Informe o nome do professor.");
    error.statusCode = 400;
    throw error;
  }

  return {
    nome,
    email: text(payload.email, 191) || null,
    telefone: text(payload.telefone, 50) || null,
    cpf: text(payload.cpf, 20) || null,
    cref: text(payload.cref, 50) || null,
    modalidades: uniqueValues(
      safeJsonParse(payload.modalidades ?? payload.modalidades_json, []).map((item) => item),
    ),
    unidades: uniqueValues(
      safeJsonParse(payload.unidades ?? payload.unidades_json, []).map((item) => item),
    ),
    turmas: uniqueValues(
      safeJsonParse(payload.turmas ?? payload.turmas_json, []).map((item) => item),
    ),
    status: normalizeStatus(payload.status),
    jornadaProfessor: text(payload.jornadaProfessor ?? payload.jornada_professor, 191) || null,
    tipoContrato: text(payload.tipoContrato ?? payload.tipo_contrato, 100) || null,
    valorContrato: numeric(
      payload.valorContrato ?? payload.valor_contrato ?? payload.valor_hora,
      0,
    ),
    formaPagamentoProfessor:
      text(payload.formaPagamentoProfessor ?? payload.forma_pagamento_professor, 50) || null,
    dataInicioContrato:
      text(payload.dataInicioContrato ?? payload.data_inicio_contrato, 10) || null,
    observacoesContrato:
      text(payload.observacoesContrato ?? payload.observacoes_contrato, 65535) || null,
    contrato: safeJsonParse(payload.contrato ?? payload.contrato_json, null),
    historicoContratos: safeJsonParse(
      payload.historicoContratos ?? payload.historico_contratos_json,
      [],
    ),
  };
}

function mapRow(row) {
  return {
    id: String(row.id),
    nome: text(row.nome, 191),
    email: text(row.email, 191),
    telefone: text(row.telefone, 50),
    cpf: text(row.cpf, 20),
    cref: text(row.cref, 50),
    modalidades: uniqueValues(safeJsonParse(row.modalidades_json, [])),
    unidades: uniqueValues(safeJsonParse(row.unidades_json, [])),
    status: normalizeStatus(row.status),
    turmas: uniqueValues(safeJsonParse(row.turmas_json, [])),
    jornadaProfessor: text(row.jornada_professor, 191),
    tipoContrato: text(row.tipo_contrato, 100),
    valorContrato: numeric(row.valor_contrato ?? row.valor_hora, 0),
    formaPagamentoProfessor: text(row.forma_pagamento_professor, 50),
    dataInicioContrato: text(row.data_inicio_contrato, 10),
    observacoesContrato: text(row.observacoes_contrato, 65535),
    contrato: safeJsonParse(row.contrato_json, null),
    historicoContratos: safeJsonParse(row.historico_contratos_json, []),
    criadoEm: row.created_at ?? null,
    atualizadoEm: row.updated_at ?? row.created_at ?? null,
  };
}

async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM j12_professores WHERE id = ? LIMIT 1", [id]);
  return Array.isArray(rows) && rows.length > 0 ? mapRow(rows[0]) : null;
}

router.use(requireAuth);

router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM j12_professores ORDER BY nome ASC");
    res.json(Array.isArray(rows) ? rows.map(mapRow) : []);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const item = await findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Professor nao encontrado." });
    }

    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para criar professores." });
    }

    const item = normalizePayload(req.body ?? {});
    const [result] = await pool.query(
      `
        INSERT INTO j12_professores (
          nome, email, telefone, cpf, cref, modalidades_json, unidades_json, turmas_json, status,
          jornada_professor, tipo_contrato, valor_contrato, forma_pagamento_professor,
          data_inicio_contrato, observacoes_contrato, contrato_json, historico_contratos_json, valor_hora
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        item.nome,
        item.email,
        item.telefone,
        item.cpf,
        item.cref,
        JSON.stringify(item.modalidades),
        JSON.stringify(item.unidades),
        JSON.stringify(item.turmas),
        item.status,
        item.jornadaProfessor,
        item.tipoContrato,
        item.valorContrato,
        item.formaPagamentoProfessor,
        item.dataInicioContrato,
        item.observacoesContrato,
        JSON.stringify(item.contrato),
        JSON.stringify(item.historicoContratos),
        item.valorContrato,
      ],
    );
    await syncProfessorUsers({ onlyProfessorId: result.insertId });
    res.status(201).json(await findById(result.insertId));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para editar professores." });
    }

    const item = normalizePayload(req.body ?? {});
    await pool.query(
      `
        UPDATE j12_professores
        SET
          nome = ?,
          email = ?,
          telefone = ?,
          cpf = ?,
          cref = ?,
          modalidades_json = ?,
          unidades_json = ?,
          turmas_json = ?,
          status = ?,
          jornada_professor = ?,
          tipo_contrato = ?,
          valor_contrato = ?,
          forma_pagamento_professor = ?,
          data_inicio_contrato = ?,
          observacoes_contrato = ?,
          contrato_json = ?,
          historico_contratos_json = ?,
          valor_hora = ?
        WHERE id = ?
      `,
      [
        item.nome,
        item.email,
        item.telefone,
        item.cpf,
        item.cref,
        JSON.stringify(item.modalidades),
        JSON.stringify(item.unidades),
        JSON.stringify(item.turmas),
        item.status,
        item.jornadaProfessor,
        item.tipoContrato,
        item.valorContrato,
        item.formaPagamentoProfessor,
        item.dataInicioContrato,
        item.observacoesContrato,
        JSON.stringify(item.contrato),
        JSON.stringify(item.historicoContratos),
        item.valorContrato,
        req.params.id,
      ],
    );

    await syncProfessorUsers({ onlyProfessorId: req.params.id });
    const saved = await findById(req.params.id);
    if (!saved) {
      return res.status(404).json({ message: "Professor nao encontrado." });
    }

    res.json(saved);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para excluir professores." });
    }

    await deactivateProfessorUsers(req.params.id);
    await pool.query("DELETE FROM j12_professores WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
