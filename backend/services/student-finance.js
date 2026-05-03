const { randomUUID } = require("node:crypto");
const { getCollectionSnapshot, query, tableExists, transaction } = require("../db");

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value ?? fallback;

  try {
    const parsed = JSON.parse(value);
    if (parsed == null) return fallback;
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : fallback;
    if (typeof fallback === "object") return typeof parsed === "object" ? parsed : fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function parseArray(value) {
  const parsed = safeJsonParse(value, []);
  return Array.isArray(parsed)
    ? Array.from(new Set(parsed.map((item) => text(item, 191)).filter(Boolean)))
    : [];
}

function numeric(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentCompetencia(referenceDate = new Date()) {
  return referenceDate.toISOString().slice(0, 7);
}

function parseCompetencia(value, fallback = currentCompetencia()) {
  const normalized = text(value, 32);
  if (/^\d{4}-\d{2}$/.test(normalized)) return normalized;
  if (/^\d{4}-\d{2}:/.test(normalized)) return normalized.slice(0, 7);
  return fallback;
}

function sanitizeDueDay(value, fallback = 10) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(28, Math.trunc(parsed)));
}

function buildDueDate(competencia, dueDay) {
  const [year, month] = competencia.split("-").map(Number);
  const date = new Date(year, month - 1, sanitizeDueDay(dueDay));
  return date.toISOString().slice(0, 10);
}

function inferPeriodicidade(planName) {
  const normalized = text(planName, 191).toLowerCase();
  if (normalized.includes("bimes")) return "bimestral";
  if (normalized.includes("trimes")) return "trimestral";
  if (normalized.includes("semes")) return "semestral";
  if (normalized.includes("anual")) return "anual";
  return "mensal";
}

function normalizeEmail(value) {
  const normalized = text(value, 191).toLowerCase();
  return normalized || null;
}

async function getPlanCatalog() {
  const hasMysqlCatalog = await tableExists("j12_planos");
  if (hasMysqlCatalog) {
    const rows = await query(
      `
        SELECT *
        FROM j12_planos
        ORDER BY nome ASC
      `,
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((row) => ({
        ...row,
        id: text(row.id, 64),
        nome: text(row.nome, 191),
        precoMensal: numeric(row.preco_mensal ?? row.valor),
        modalidades: parseArray(row.modalidades_json),
      }));
    }
  }

  const snapshot = await getCollectionSnapshot("planos");
  return Array.isArray(snapshot?.data) ? snapshot.data : [];
}

function findPlan(planCatalog, financeConfig, student) {
  const desiredPlanId = text(financeConfig?.planoId || student.plano_id, 64);
  const desiredPlanName = text(
    financeConfig?.planoNome || student.plano_principal || student.plano_nome,
    191,
  );

  return (
    planCatalog.find((plan) => text(plan?.id, 64) === desiredPlanId) ??
    planCatalog.find(
      (plan) => text(plan?.nome, 191).toLowerCase() === desiredPlanName.toLowerCase(),
    ) ??
    null
  );
}

function resolveChargeConfig(student, planCatalog) {
  const financeConfig = safeJsonParse(student.financeiro_json, {});
  const plan = findPlan(planCatalog, financeConfig, student);
  const planName =
    text(financeConfig?.planoNome, 191) ||
    text(student.plano_principal, 191) ||
    text(plan?.nome, 191);
  const value =
    numeric(financeConfig?.valorPlano) ||
    numeric(student.plano_valor) ||
    numeric(plan?.precoMensal) ||
    numeric(financeConfig?.valor) ||
    0;

  return {
    planId: text(financeConfig?.planoId || student.plano_id, 64) || text(plan?.id, 64) || null,
    planName,
    value,
    dueDay: sanitizeDueDay(financeConfig?.diaVencimento, 10),
    periodicidade: text(financeConfig?.periodicidade, 30) || inferPeriodicidade(planName),
    recorrenciaAtiva:
      financeConfig?.recorrenciaAtiva !== false && financeConfig?.cobrancaAutomatica !== false,
    descontoValor: numeric(financeConfig?.descontoValor),
    descontoPercentual: numeric(financeConfig?.descontoPercentual),
    bolsaValor: numeric(financeConfig?.bolsaValor),
    bolsaPercentual: numeric(financeConfig?.bolsaPercentual),
    multaPercentual: numeric(financeConfig?.multaPercentual),
    jurosDiaPercentual: numeric(financeConfig?.jurosDiaPercentual),
    observacoes: text(financeConfig?.observacoes, 65535) || null,
  };
}

function resolveFinalAmount(config) {
  const descontoPercentual = numeric(config.descontoPercentual);
  const descontoValor = numeric(config.descontoValor + config.value * (descontoPercentual / 100));
  const bolsaPercentual = numeric(config.bolsaPercentual);
  const bolsaValor = numeric(config.bolsaValor + config.value * (bolsaPercentual / 100));
  const finalValue = Math.max(0, numeric(config.value - descontoValor - bolsaValor));

  return {
    valorOriginal: numeric(config.value),
    descontoValor,
    descontoPercentual,
    bolsaValor,
    bolsaPercentual,
    valorFinal: finalValue,
  };
}

function computeApiStatus(row) {
  const storedStatus = text(row.status, 30).toLowerCase();
  if (storedStatus === "pago") return "pago";
  if (storedStatus === "cancelado") return "cancelada";
  if (storedStatus === "atrasado") return "vencido";
  return row.vencimento < todayISO() ? "vencido" : "pendente";
}

function normalizeDatabaseStatus(status, dueDate) {
  const normalized = text(status, 30).toLowerCase();
  if (normalized === "pago") return "pago";
  if (normalized === "cancelada" || normalized === "cancelado") return "cancelado";
  if (normalized === "vencido" || normalized === "atrasado") return "atrasado";
  if (normalized === "parcial") return "pendente";
  if (dueDate && dueDate < todayISO()) return "atrasado";
  return "pendente";
}

function mapChargeRow(row) {
  const finalValue = numeric(row.valor_final ?? row.valor);

  return {
    id: String(row.id),
    alunoId: String(row.aluno_id),
    alunoNome: text(row.nome_aluno, 191) || "Aluno",
    descricao: text(row.descricao, 191),
    tipo: row.tipo ?? "mensalidade",
    valor: finalValue,
    vencimento: row.vencimento,
    pagoEm: row.pago_em ?? null,
    formaPagamento: row.forma_pagamento ?? undefined,
    observacao: row.observacao ?? undefined,
    responsavelFinanceiro: row.responsavel_financeiro ?? undefined,
    responsavelCpf: row.responsavel_cpf ?? undefined,
    telefoneWhatsapp: row.telefone_whatsapp ?? undefined,
    email: row.email ?? undefined,
    unidade: row.unidade ?? undefined,
    modalidade: row.modalidade ?? undefined,
    turma: row.turma ?? undefined,
    planoId: row.plano_id == null ? null : String(row.plano_id),
    planoNome: row.plano_nome ?? undefined,
    periodicidade: row.periodicidade ?? "mensal",
    competencia: row.competencia,
    valorOriginal: numeric(row.valor_original ?? row.valor),
    descontoValor: numeric(row.desconto_valor),
    descontoPercentual: numeric(row.desconto_percentual),
    bolsaValor: numeric(row.bolsa_valor),
    bolsaPercentual: numeric(row.bolsa_percentual),
    multaPercentual: numeric(row.multa_percentual),
    jurosDiaPercentual: numeric(row.juros_dia_percentual),
    valorFinal: finalValue,
    dataGeracao: row.data_geracao ?? row.created_at?.slice?.(0, 10) ?? null,
    dataPagamento: row.data_pagamento ?? row.pago_em ?? null,
    status: computeApiStatus(row),
    tipoCobranca: row.tipo_cobranca ?? "recorrente",
    origem: row.origem === "automatico" ? "automatica" : "manual",
    ativo: row.ativo == null ? true : Boolean(row.ativo),
    alteradoEm: row.alterado_em ?? null,
    alteradoPor: row.alterado_por ?? null,
    cancelamentoMotivo: row.cancelamento_motivo ?? null,
    descontoMotivo: row.desconto_motivo ?? null,
  };
}

async function loadChargeRowById(chargeId, connection = null) {
  const normalizedId = text(chargeId, 64);
  if (!normalizedId) return null;

  if (connection) {
    const [rows] = await connection.execute(
      `
        SELECT *
        FROM j12_financeiro_cobrancas
        WHERE id = ?
        LIMIT 1
      `,
      [normalizedId],
    );

    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  const rows = await query(
    `
      SELECT *
      FROM j12_financeiro_cobrancas
      WHERE id = ?
      LIMIT 1
    `,
    [normalizedId],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function removeChargeCompatibility(chargeId, connection = null) {
  const normalizedId = text(chargeId, 64);
  if (!normalizedId) return;

  const executor = connection ?? { execute: (sql, params) => query(sql, params) };

  await executor.execute(
    `
      DELETE FROM j12_pagamentos
      WHERE cobranca_id = ? OR mensalidade_id = ?
    `,
    [normalizedId, normalizedId],
  );

  await executor.execute(
    `
      DELETE FROM j12_mensalidades
      WHERE cobranca_id = ? OR id = ?
    `,
    [normalizedId, normalizedId],
  );
}

async function resolveCompatiblePlanId(planId, connection = null) {
  const normalizedPlanId = text(planId, 64);
  if (!normalizedPlanId) return null;

  const numericPlanId = Number(normalizedPlanId);
  if (!Number.isInteger(numericPlanId) || numericPlanId <= 0) {
    return null;
  }

  const executor = connection ?? { execute: (sql, params) => query(sql, params) };
  const [rows] = await executor.execute(
    `
      SELECT id
      FROM j12_planos
      WHERE id = ?
      LIMIT 1
    `,
    [numericPlanId],
  );

  return Array.isArray(rows) && rows.length > 0 ? numericPlanId : null;
}

async function syncChargeCompatibility(chargeOrId, connection = null) {
  const chargeRow =
    typeof chargeOrId === "string"
      ? await loadChargeRowById(chargeOrId, connection)
      : (chargeOrId ?? null);

  if (!chargeRow) {
    if (typeof chargeOrId === "string") {
      await removeChargeCompatibility(chargeOrId, connection);
    }
    return null;
  }

  const executor = connection ?? { execute: (sql, params) => query(sql, params) };
  const mensalidadeId = text(chargeRow.id, 64);
  const pagamentoId = text(`pag-${chargeRow.id}`, 64);
  const paymentDate = chargeRow.data_pagamento ?? chargeRow.pago_em ?? null;
  const finalValue = numeric(chargeRow.valor_final ?? chargeRow.valor, 0);
  const compatiblePlanId = await resolveCompatiblePlanId(chargeRow.plano_id, connection);

  await executor.execute(
    `
      INSERT INTO j12_mensalidades (
        id,
        cobranca_id,
        aluno_id,
        plano_id,
        turma,
        referencia,
        valor,
        data_vencimento,
        data_pagamento,
        forma_pagamento,
        status,
        observacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        cobranca_id = VALUES(cobranca_id),
        aluno_id = VALUES(aluno_id),
        plano_id = VALUES(plano_id),
        turma = VALUES(turma),
        referencia = VALUES(referencia),
        valor = VALUES(valor),
        data_vencimento = VALUES(data_vencimento),
        data_pagamento = VALUES(data_pagamento),
        forma_pagamento = VALUES(forma_pagamento),
        status = VALUES(status),
        observacao = VALUES(observacao)
    `,
    [
      mensalidadeId,
      text(chargeRow.id, 64),
      text(chargeRow.aluno_id, 64),
      compatiblePlanId,
      text(chargeRow.turma, 191) || null,
      text(chargeRow.competencia, 7),
      finalValue,
      chargeRow.vencimento,
      paymentDate,
      text(chargeRow.forma_pagamento, 50) || null,
      normalizeDatabaseStatus(chargeRow.status, chargeRow.vencimento),
      text(chargeRow.observacao, 65535) || null,
    ],
  );

  if (normalizeDatabaseStatus(chargeRow.status, chargeRow.vencimento) === "pago" && paymentDate) {
    await executor.execute(
      `
        INSERT INTO j12_pagamentos (
          id,
          mensalidade_id,
          cobranca_id,
          aluno_id,
          valor,
          forma_pagamento,
          data_pagamento,
          observacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          mensalidade_id = VALUES(mensalidade_id),
          cobranca_id = VALUES(cobranca_id),
          aluno_id = VALUES(aluno_id),
          valor = VALUES(valor),
          forma_pagamento = VALUES(forma_pagamento),
          data_pagamento = VALUES(data_pagamento),
          observacao = VALUES(observacao)
      `,
      [
        pagamentoId,
        mensalidadeId,
        text(chargeRow.id, 64),
        text(chargeRow.aluno_id, 64),
        finalValue,
        text(chargeRow.forma_pagamento, 50) || null,
        paymentDate,
        text(chargeRow.observacao, 65535) || null,
      ],
    );
  } else {
    await executor.execute(
      `
        DELETE FROM j12_pagamentos
        WHERE cobranca_id = ? OR mensalidade_id = ?
      `,
      [text(chargeRow.id, 64), mensalidadeId],
    );
  }

  return {
    mensalidadeId,
    pagamentoId: paymentDate ? pagamentoId : null,
  };
}

async function syncAllChargeCompatibilityTables() {
  const rows = await query(
    `
      SELECT *
      FROM j12_financeiro_cobrancas
      ORDER BY created_at ASC, id ASC
    `,
  );

  const normalizedRows = Array.isArray(rows) ? rows : [];

  await transaction(async (connection) => {
    await connection.execute("DELETE FROM j12_pagamentos");
    await connection.execute("DELETE FROM j12_mensalidades");

    for (const row of normalizedRows) {
      await syncChargeCompatibility(row, connection);
    }
  });

  return {
    synced: normalizedRows.length,
  };
}

async function listCharges(options = {}) {
  const params = [];
  const conditions = [];

  if (options.studentId) {
    conditions.push("aluno_id = ?");
    params.push(String(options.studentId));
  }

  if (options.chargeId) {
    conditions.push("id = ?");
    params.push(String(options.chargeId));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await query(
    `
      SELECT *
      FROM j12_financeiro_cobrancas
      ${whereClause}
      ORDER BY vencimento DESC, updated_at DESC
    `,
    params,
  );

  return (Array.isArray(rows) ? rows : []).map(mapChargeRow);
}

async function loadStudentFinanceRows({ studentId = null, onlyActive = false } = {}) {
  const params = [];
  const conditions = [];

  if (studentId) {
    conditions.push("aluno.id = ?");
    params.push(String(studentId));
  }

  if (onlyActive) {
    conditions.push("LOWER(aluno.status) = 'ativo'");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return query(
    `
      SELECT
        aluno.*,
        resp.nome_completo AS responsavel_nome,
        resp.cpf AS responsavel_cpf,
        resp.whatsapp AS responsavel_whatsapp,
        resp.email AS responsavel_email,
        esporte.unidades_json,
        esporte.modalidades_json,
        esporte.turmas_json
      FROM j12_alunos aluno
      LEFT JOIN j12_alunos_responsaveis resp ON resp.aluno_id = aluno.id
      LEFT JOIN j12_alunos_esportes esporte ON esporte.aluno_id = aluno.id
      ${whereClause}
      ORDER BY aluno.nome_completo ASC
    `,
    params,
  );
}

async function ensureStudentMonthlyCharge(connection, student, options = {}) {
  const competencia = parseCompetencia(options.referenceCompetencia);
  const planCatalog = options.planCatalog ?? (await getPlanCatalog());
  const chargeConfig = resolveChargeConfig(student, planCatalog);

  if (
    text(student.status, 30).toLowerCase() !== "ativo" ||
    !chargeConfig.recorrenciaAtiva ||
    !chargeConfig.planName ||
    chargeConfig.value <= 0
  ) {
    return {
      created: false,
      skippedReason: "inactive_or_unconfigured",
      competencia,
    };
  }

  const normalizedPlanId = chargeConfig.planId || "";
  const [existingRows] = await connection.execute(
    `
      SELECT id
      FROM j12_financeiro_cobrancas
      WHERE aluno_id = ?
        AND competencia = ?
        AND COALESCE(plano_id, '') = ?
        AND status <> 'cancelado'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [String(student.id), competencia, normalizedPlanId],
  );

  if (Array.isArray(existingRows) && existingRows.length > 0) {
    return {
      created: false,
      skippedReason: "duplicate",
      competencia,
      chargeId: String(existingRows[0].id),
    };
  }

  const values = resolveFinalAmount(chargeConfig);
  const units = parseArray(student.unidades_json);
  const modalities = parseArray(student.modalidades_json);
  const classes = parseArray(student.turmas_json);
  const dueDate = buildDueDate(competencia, chargeConfig.dueDay);
  const descriptionBase = chargeConfig.planName;
  const description = descriptionBase.toLowerCase().includes("mensalidade")
    ? descriptionBase
    : `Mensalidade - ${descriptionBase}`;
  const chargeId = `cob-${randomUUID().replace(/-/g, "").slice(0, 24)}`;

  await connection.execute(
    `
      INSERT INTO j12_financeiro_cobrancas (
        id, aluno_id, numero_matricula, nome_aluno, competencia, descricao, tipo, valor, vencimento,
        status, origem, periodicidade, plano_id, plano_nome, modalidade, turma, unidade,
        responsavel_financeiro, responsavel_cpf, telefone_whatsapp, email, observacao,
        pago_em, forma_pagamento, data_geracao, data_pagamento, valor_original,
        desconto_valor, desconto_percentual, bolsa_valor, bolsa_percentual, multa_percentual,
        juros_dia_percentual, valor_final, tipo_cobranca, ativo, alterado_em, alterado_por,
        cancelamento_motivo, desconto_motivo
      ) VALUES (?, ?, ?, ?, ?, ?, 'mensalidade', ?, ?, 'pendente', 'automatico', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, CURDATE(), NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'recorrente', 1, NULL, ?, NULL, NULL)
    `,
    [
      chargeId,
      String(student.id),
      text(student.numero_matricula, 50) || null,
      text(student.nome_completo, 191) || "Aluno",
      competencia,
      text(description, 191),
      values.valorFinal,
      dueDate,
      text(chargeConfig.periodicidade, 30) || "mensal",
      chargeConfig.planId,
      text(chargeConfig.planName, 191),
      text(student.modalidade_principal, 191) || text(modalities[0], 191) || null,
      text(student.turma_principal, 191) || text(classes[0], 191) || null,
      text(student.unidade_principal, 191) || text(units[0], 191) || null,
      text(student.responsavel_nome, 191) || text(student.nome_completo, 191) || null,
      text(student.responsavel_cpf, 20) || null,
      text(student.responsavel_whatsapp || student.telefone_contato, 50) || null,
      normalizeEmail(student.responsavel_email || student.email_contato),
      chargeConfig.observacoes,
      values.valorOriginal,
      values.descontoValor,
      values.descontoPercentual,
      values.bolsaValor,
      values.bolsaPercentual,
      numeric(chargeConfig.multaPercentual),
      numeric(chargeConfig.jurosDiaPercentual),
      values.valorFinal,
      text(options.actorName, 191) || "sistema",
    ],
  );

  await syncChargeCompatibility(chargeId, connection);

  return {
    created: true,
    skippedReason: null,
    competencia,
    chargeId,
  };
}

async function generateMonthlyChargeForStudent(studentId, options = {}) {
  const students = await loadStudentFinanceRows({ studentId, onlyActive: false });
  if (!Array.isArray(students) || students.length === 0) {
    const error = new Error("Aluno nao encontrado para gerar mensalidade.");
    error.statusCode = 404;
    throw error;
  }

  const planCatalog = await getPlanCatalog();
  return transaction((connection) =>
    ensureStudentMonthlyCharge(connection, students[0], {
      ...options,
      planCatalog,
    }),
  );
}

async function generateMonthlyCharges(options = {}) {
  const competencia = parseCompetencia(options.referenceCompetencia);
  const students = await loadStudentFinanceRows({ onlyActive: true });
  const planCatalog = await getPlanCatalog();
  const summary = {
    competencia,
    created: 0,
    skipped: 0,
  };

  if (!Array.isArray(students) || students.length === 0) {
    return summary;
  }

  await transaction(async (connection) => {
    for (const student of students) {
      const result = await ensureStudentMonthlyCharge(connection, student, {
        ...options,
        referenceCompetencia: competencia,
        planCatalog,
      });

      if (result.created) {
        summary.created += 1;
      } else {
        summary.skipped += 1;
      }
    }
  });

  return summary;
}

async function markOverdueCharges(actorName = "sistema") {
  const result = await query(
    `
      UPDATE j12_financeiro_cobrancas
      SET
        status = 'atrasado',
        alterado_em = NOW(),
        alterado_por = ?
      WHERE status = 'pendente'
        AND vencimento < CURDATE()
    `,
    [text(actorName, 191) || "sistema"],
  );

  await syncAllChargeCompatibilityTables();
  return Number(result?.affectedRows || 0);
}

module.exports = {
  listCharges,
  mapChargeRow,
  computeApiStatus,
  normalizeDatabaseStatus,
  parseCompetencia,
  ensureStudentMonthlyCharge,
  generateMonthlyChargeForStudent,
  generateMonthlyCharges,
  markOverdueCharges,
  syncChargeCompatibility,
  syncAllChargeCompatibilityTables,
  removeChargeCompatibility,
};
