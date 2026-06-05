/**
 * Controllers públicos para catálogo de dados (modalidades, unidades, turmas)
 * Utilizados na página de matrícula pública do aluno
 */

const { pool } = require("../config/db.js");

const ACTIVE_TURMA_WHERE = `
  LOWER(COALESCE(turma.status, 'ativa')) NOT IN (
    'inativa',
    'inativo',
    'inactive',
    'cancelada',
    'cancelado',
    'excluida',
    'excluido'
  )
`;

function normalizeActiveStatus(value) {
  const normalized = String(value ?? "ativa")
    .trim()
    .toLowerCase();

  return ![
    "inativa",
    "inativo",
    "inactive",
    "cancelada",
    "cancelado",
    "excluida",
    "excluido",
  ].includes(normalized);
}

// ============================================
// MODALIDADES
// ============================================

async function getPublicModalidades(_req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT id, nome, descricao, destaque, status FROM j12_modalidades WHERE status = 'ativo' ORDER BY nome ASC",
    );

    const data = Array.isArray(rows)
      ? rows.map((row) => ({
          id: row.id,
          nome: row.nome,
          descricao: row.descricao,
          destaque: row.destaque,
          ativa: row.status === "ativo",
          status: row.status,
        }))
      : [];
    console.log("[PUBLIC] Modalidades retornadas:", data.length);
    res.json(data);
  } catch (error) {
    console.error("[PUBLIC] Erro ao buscar modalidades:", error);
    next(error);
  }
}

// ============================================
// UNIDADES
// ============================================

async function getPublicUnidades(_req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT id, nome, endereco, cidade, estado, telefone, status FROM j12_unidades WHERE status = 'ativo' ORDER BY nome ASC",
    );

    const data = Array.isArray(rows)
      ? rows.map((row) => ({
          id: row.id,
          nome: row.nome,
          endereco: row.endereco,
          cidade: row.cidade,
          estado: row.estado,
          telefone: row.telefone,
          ativa: row.status === "ativo",
          status: row.status,
        }))
      : [];
    console.log("[PUBLIC] Unidades retornadas:", data.length);
    res.json(data);
  } catch (error) {
    console.error("[PUBLIC] Erro ao buscar unidades:", error);
    next(error);
  }
}

// ============================================
// TURMAS
// ============================================

async function getPublicTurmas(_req, res, next) {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          turma.id,
          turma.nome,
          COALESCE(turma.modalidade, modalidade.nome) AS modalidade,
          turma.modalidade_id,
          COALESCE(turma.unidade, unidade.nome) AS unidade,
          turma.unidade_id,
          turma.professor_id,
          COALESCE(professor.nome, turma.professor_nome) AS professor,
          turma.dias_semana_json,
          turma.horario_inicio,
          turma.horario_fim,
          turma.capacidade,
          turma.status,
          turma.created_at
        FROM j12_turmas turma
        LEFT JOIN j12_professores professor ON professor.id = turma.professor_id
        LEFT JOIN j12_modalidades modalidade ON modalidade.id = turma.modalidade_id
        LEFT JOIN j12_unidades unidade ON unidade.id = turma.unidade_id
        WHERE ${ACTIVE_TURMA_WHERE}
        ORDER BY turma.nome ASC
      `,
    );

    const data = Array.isArray(rows)
      ? rows.map((row) => {
          try {
            const diasSemana = row.dias_semana_json
              ? typeof row.dias_semana_json === "string"
                ? JSON.parse(row.dias_semana_json)
                : row.dias_semana_json
              : [];

            return {
              id: row.id,
              nome: row.nome,
              modalidade: row.modalidade,
              modalidadeId: row.modalidade_id,
              unidade: row.unidade,
              unidadeId: row.unidade_id,
              professorId: row.professor_id,
              professor: row.professor,
              diasSemana: diasSemana,
              horarioInicio: row.horario_inicio,
              horarioFim: row.horario_fim,
              capacidadeMaxima: row.capacidade,
              ativa: normalizeActiveStatus(row.status),
              status: row.status,
            };
          } catch (e) {
            console.warn("Erro ao normalizar turma:", row, e);
            return row;
          }
        })
      : [];

    console.log("[PUBLIC] Turmas retornadas:", data.length);
    res.json(data);
  } catch (error) {
    console.error("[PUBLIC] Erro ao buscar turmas:", error);
    next(error);
  }
}

// ============================================
// HORÁRIOS (alias para turmas)
// ============================================

async function getPublicHorarios(req, res, next) {
  // Redireciona para turmas já que horários são turmas
  return getPublicTurmas(req, res, next);
}

module.exports = {
  getPublicModalidades,
  getPublicUnidades,
  getPublicTurmas,
  getPublicHorarios,
};
