const express = require("express");
const router = express.Router();

const { canManageSystem, requireAuth } = require("../../auth.js");
const { pool } = require("../config/db.js");

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function numeric(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function integer(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function asBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "sim", "yes"].includes(normalized)) return true;
    if (["0", "false", "nao", "não", "no"].includes(normalized)) return false;
  }

  return fallback;
}

function uniqueValues(values) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => {
          if (Array.isArray(value)) return value;
          if (typeof value === "string") {
            const normalized = value.trim();
            if (!normalized) return [];

            if (
              (normalized.startsWith("[") && normalized.endsWith("]")) ||
              (normalized.startsWith("{") && normalized.endsWith("}"))
            ) {
              try {
                const parsed = JSON.parse(normalized);
                return Array.isArray(parsed) ? parsed : [normalized];
              } catch {
                return normalized.split(/[;,|]/g);
              }
            }

            return normalized.split(/[;,|]/g);
          }

          return value == null ? [] : [String(value)];
        })
        .map((item) => String(item ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function normalizeStatus(value) {
  const normalized = text(value, 30).toLowerCase();
  if (normalized === "rascunho") return "rascunho";
  if (normalized === "arquivado" || normalized === "inativo") return "arquivado";
  return "ativo";
}

function normalizeCategoria(value) {
  const normalized = text(value, 50);
  const allowed = new Set(["Kids", "Base", "Performance", "Adulto", "Personalizado"]);
  return allowed.has(normalized) ? normalized : "Base";
}

function inferFrequencia(name, aulasPorSemana, explicitValue) {
  const explicit = text(explicitValue, 100);
  if (explicit) return explicit;

  const normalized = text(name, 191).toLowerCase();
  if (normalized.includes("1x")) return "1x semana";
  if (normalized.includes("2x")) return "2x semana";
  if (normalized.includes("3x")) return "3x semana";
  if (normalized.includes("4x")) return "4x semana";
  if (normalized.includes("5x")) return "5x semana";
  if (normalized.includes("anual")) return "Anual";
  if (normalized.includes("semes")) return "Semestral";
  if (normalized.includes("trimes")) return "Trimestral";
  if (normalized.includes("bimes")) return "Bimestral";
  if (aulasPorSemana > 0) return `${aulasPorSemana}x semana`;
  return "Mensal";
}

function normalizePlanoPayload(payload) {
  const nome = text(payload.nome, 191);
  const precoMensal = numeric(payload.precoMensal ?? payload.valor);
  const modalidades = uniqueValues([payload.modalidades, payload.modalidade]);
  const aulasPorSemana = integer(payload.aulasPorSemana ?? payload.aulas_por_semana, 1);

  if (!nome || precoMensal <= 0) {
    const error = new Error("Informe nome e valor do plano.");
    error.statusCode = 400;
    throw error;
  }

  return {
    nome,
    valor: precoMensal,
    modalidade: text(payload.modalidade, 191) || modalidades[0] || null,
    unidade: text(payload.unidade, 191) || null,
    dias_horarios: text(payload.dias_horarios ?? payload.diasHorarios, 255) || null,
    frequencia: inferFrequencia(nome, aulasPorSemana, payload.frequencia),
    status: normalizeStatus(payload.status),
    categoria: normalizeCategoria(payload.categoria),
    descricao: text(payload.descricao, 65535) || "",
    preco_mensal: precoMensal,
    taxa_matricula: numeric(payload.taxaMatricula ?? payload.taxa_matricula),
    fidelidade_meses: integer(payload.fidelidadeMeses ?? payload.fidelidade_meses, 1) || 1,
    aulas_por_semana: aulasPorSemana,
    modalidades_json: JSON.stringify(modalidades),
    tags_json: JSON.stringify(uniqueValues([payload.tags])),
    contrato_vinculado: asBoolean(payload.contratoVinculado ?? payload.contrato_vinculado, true),
    aceita_upgrade: asBoolean(payload.aceitaUpgrade ?? payload.aceita_upgrade, true),
    destaque_comercial: asBoolean(payload.destaqueComercial ?? payload.destaque_comercial, false),
  };
}

function mapPlanoRow(row) {
  const modalidades = uniqueValues([row.modalidades_json, row.modalidade]);
  const tags = uniqueValues([row.tags_json]);
  const valor = numeric(row.preco_mensal ?? row.valor);
  const aulasPorSemana = integer(row.aulas_por_semana, 1) || 1;

  return {
    id: String(row.id),
    nome: text(row.nome, 191),
    valor,
    modalidade: text(row.modalidade, 191) || modalidades[0] || "",
    unidade: text(row.unidade, 191) || "",
    dias_horarios: text(row.dias_horarios, 255) || "",
    frequencia: inferFrequencia(row.nome, aulasPorSemana, row.frequencia),
    status: normalizeStatus(row.status),
    categoria: normalizeCategoria(row.categoria),
    descricao: text(row.descricao, 65535) || "",
    precoMensal: valor,
    taxaMatricula: numeric(row.taxa_matricula),
    fidelidadeMeses: integer(row.fidelidade_meses, 1) || 1,
    aulasPorSemana,
    modalidades,
    tags,
    contratoVinculado: asBoolean(row.contrato_vinculado, true),
    aceitaUpgrade: asBoolean(row.aceita_upgrade, true),
    destaqueComercial: asBoolean(row.destaque_comercial, false),
    atualizadoEm: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? row.created_at ?? null,
  };
}

async function findPlanoById(id) {
  const [rows] = await pool.query(
    `
      SELECT *
      FROM j12_planos
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return Array.isArray(rows) && rows.length > 0 ? mapPlanoRow(rows[0]) : null;
}

router.use(requireAuth);

router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT *
        FROM j12_planos
        ORDER BY updated_at DESC, created_at DESC, id DESC
      `,
    );

    res.json(Array.isArray(rows) ? rows.map(mapPlanoRow) : []);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const plano = await findPlanoById(req.params.id);
    if (!plano) {
      return res.status(404).json({ message: "Plano nao encontrado." });
    }

    res.json(plano);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para criar planos." });
    }

    const plano = normalizePlanoPayload(req.body ?? {});

    const [result] = await pool.query(
      `
        INSERT INTO j12_planos (
          nome,
          valor,
          modalidade,
          unidade,
          dias_horarios,
          frequencia,
          status,
          categoria,
          descricao,
          preco_mensal,
          taxa_matricula,
          fidelidade_meses,
          aulas_por_semana,
          modalidades_json,
          tags_json,
          contrato_vinculado,
          aceita_upgrade,
          destaque_comercial
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        plano.nome,
        plano.valor,
        plano.modalidade,
        plano.unidade,
        plano.dias_horarios,
        plano.frequencia,
        plano.status,
        plano.categoria,
        plano.descricao,
        plano.preco_mensal,
        plano.taxa_matricula,
        plano.fidelidade_meses,
        plano.aulas_por_semana,
        plano.modalidades_json,
        plano.tags_json,
        plano.contrato_vinculado ? 1 : 0,
        plano.aceita_upgrade ? 1 : 0,
        plano.destaque_comercial ? 1 : 0,
      ],
    );

    const saved = await findPlanoById(result.insertId);
    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para editar planos." });
    }

    const plano = normalizePlanoPayload(req.body ?? {});

    await pool.query(
      `
        UPDATE j12_planos
        SET
          nome = ?,
          valor = ?,
          modalidade = ?,
          unidade = ?,
          dias_horarios = ?,
          frequencia = ?,
          status = ?,
          categoria = ?,
          descricao = ?,
          preco_mensal = ?,
          taxa_matricula = ?,
          fidelidade_meses = ?,
          aulas_por_semana = ?,
          modalidades_json = ?,
          tags_json = ?,
          contrato_vinculado = ?,
          aceita_upgrade = ?,
          destaque_comercial = ?
        WHERE id = ?
      `,
      [
        plano.nome,
        plano.valor,
        plano.modalidade,
        plano.unidade,
        plano.dias_horarios,
        plano.frequencia,
        plano.status,
        plano.categoria,
        plano.descricao,
        plano.preco_mensal,
        plano.taxa_matricula,
        plano.fidelidade_meses,
        plano.aulas_por_semana,
        plano.modalidades_json,
        plano.tags_json,
        plano.contrato_vinculado ? 1 : 0,
        plano.aceita_upgrade ? 1 : 0,
        plano.destaque_comercial ? 1 : 0,
        req.params.id,
      ],
    );

    const saved = await findPlanoById(req.params.id);
    if (!saved) {
      return res.status(404).json({ message: "Plano nao encontrado." });
    }

    res.json(saved);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Sem permissao para excluir planos." });
    }

    await pool.query("DELETE FROM j12_planos WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
