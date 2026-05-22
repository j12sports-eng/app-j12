const express = require("express");
const axios = require("axios");
const { query } = require("../db");
const { canManageSystem, requireAuth, resolveScopedStudentId } = require("../auth");
const {
  sanitizeBoolean,
  sanitizeIsoDate,
  sanitizeNullableString,
  sanitizeNumber,
  sanitizeString,
  createId,
} = require("./helpers");
const {
  generateMonthlyChargeForStudent,
  generateMonthlyCharges,
  listCharges,
  mapChargeRow,
  markOverdueCharges,
  normalizeDatabaseStatus,
  parseCompetencia,
  removeChargeCompatibility,
  syncAllChargeCompatibilityTables,
  syncChargeCompatibility,
} = require("../services/student-finance");

const router = express.Router();

function normalizeCompetencia(value, fallbackDate) {
  return parseCompetencia(value, fallbackDate.slice(0, 7));
}

function normalizeOrigem(value) {
  const normalized = sanitizeString(value, 50).toLowerCase();
  if (normalized === "automatico" || normalized === "automatica") return "automatico";
  return "manual";
}

function mapTipoToChargeKind(value) {
  const normalized = sanitizeString(value, 30).toLowerCase();
  return normalized === "recorrente" ? "recorrente" : "avulsa";
}

function getBotConversaConfig() {
  return {
    url: sanitizeString(
      process.env.BOTCONVERSA_WEBHOOK_URL || process.env.BOTCONVERSA_API_URL,
      1000,
    ),
    token: sanitizeString(process.env.BOTCONVERSA_API_KEY || process.env.BOTCONVERSA_TOKEN, 1000),
  };
}

async function sendBotConversaChargeMessage(charge, extraPayload = {}) {
  const config = getBotConversaConfig();
  if (!config.url) {
    return {
      sent: false,
      skipped: true,
      reason: "BOTCONVERSA_WEBHOOK_URL nao configurada.",
    };
  }

  const payload = {
    event: "j12_pay_cobranca_criada",
    aluno: charge.alunoNome,
    alunoId: charge.alunoId,
    responsavel: charge.responsavelFinanceiro,
    telefone: charge.telefoneWhatsapp,
    email: charge.email,
    descricao: charge.descricao,
    categoria: charge.tipo,
    valor: Number(charge.valorFinal ?? charge.valor ?? 0),
    vencimento: charge.vencimento,
    formaPagamento: charge.formaPagamento || "pix",
    ...extraPayload,
  };

  const response = await axios.post(config.url, payload, {
    timeout: Number(process.env.BOTCONVERSA_TIMEOUT_MS || 15000),
    headers: {
      "Content-Type": "application/json",
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
    },
  });

  return {
    sent: true,
    skipped: false,
    status: response.status,
  };
}

function emitFinanceiroRealtime(event, payload = {}) {
  const io = global.io;
  if (!io || typeof io.emit !== "function") return;

  const data = {
    event,
    ...payload,
    emittedAt: new Date().toISOString(),
  };

  // Mantem os canais ja consumidos pelos portais e adiciona um evento especifico de cobranca.
  io.emit("financeiro:cobranca-atualizada", data);
  io.emit("financeiro:pagamento-atualizado", data);
  io.emit("dashboard:financeiro-atualizado", data);
}

const DESPESA_CATEGORIAS = new Set([
  "aluguel",
  "iptu",
  "energia",
  "agua",
  "funcionarios",
  "material_esportivo",
  "marketing",
  "pedreiro",
  "prestadores_servico",
  "manutencao",
  "arbitragem",
  "reformas",
  "eletricista",
  "encanador",
  "limpeza",
  "fornecedores_gerais",
  "impostos",
  "contas_operacionais",
  "outros",
]);

function normalizeExpenseCategory(value) {
  const normalized = sanitizeString(value, 80)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (normalized === "prestadores_de_servico") return "prestadores_servico";
  if (normalized === "fornecedores") return "fornecedores_gerais";
  if (normalized === "contas") return "contas_operacionais";
  if (normalized === "material") return "material_esportivo";
  if (normalized === "agua_luz") return "contas_operacionais";
  return DESPESA_CATEGORIAS.has(normalized) ? normalized : normalized || "outros";
}

async function ensureExpenseTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS j12_financeiro_despesas (
      id VARCHAR(64) PRIMARY KEY,
      descricao VARCHAR(191) NOT NULL,
      categoria VARCHAR(80) NOT NULL,
      valor DECIMAL(10,2) NOT NULL DEFAULT 0,
      vencimento DATE NULL,
      pago_em DATE NULL,
      forma_pagamento VARCHAR(50) NULL,
      status ENUM('pendente', 'pago', 'vencido', 'cancelado') NOT NULL DEFAULT 'pago',
      observacao TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_j12_financeiro_despesas_categoria (categoria),
      INDEX idx_j12_financeiro_despesas_status (status),
      INDEX idx_j12_financeiro_despesas_vencimento (vencimento)
    )
  `);
}

function mapExpenseRow(row) {
  return {
    id: String(row.id),
    descricao: sanitizeString(row.descricao, 191),
    categoria: normalizeExpenseCategory(row.categoria),
    valor: sanitizeNumber(row.valor),
    vencimento: row.vencimento ?? null,
    pagoEm: row.pago_em ?? null,
    formaPagamento: row.forma_pagamento ?? null,
    status: sanitizeString(row.status, 30) || "pago",
    observacao: row.observacao ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

async function listExpenses() {
  await ensureExpenseTable();
  const rows = await query(`
    SELECT *
    FROM j12_financeiro_despesas
    ORDER BY COALESCE(pago_em, vencimento, created_at) DESC, created_at DESC
  `);
  return (Array.isArray(rows) ? rows : []).map(mapExpenseRow);
}

async function createExpenseRecord(payload) {
  await ensureExpenseTable();

  const descricao = sanitizeString(payload.descricao, 191);
  const valor = sanitizeNumber(payload.valor);
  if (!descricao || valor <= 0) {
    const error = new Error("Descricao e valor da despesa sao obrigatorios.");
    error.statusCode = 400;
    throw error;
  }

  const despesa = {
    id: sanitizeString(payload.id, 64) || createId("desp"),
    descricao,
    categoria: normalizeExpenseCategory(payload.categoria),
    valor,
    vencimento: sanitizeIsoDate(payload.vencimento) || null,
    pagoEm:
      sanitizeIsoDate(payload.pagoEm ?? payload.pago_em) || new Date().toISOString().slice(0, 10),
    formaPagamento: sanitizeNullableString(payload.formaPagamento ?? payload.forma_pagamento, 50),
    status: sanitizeString(payload.status, 30) || "pago",
    observacao: sanitizeNullableString(payload.observacao, 65535),
  };

  await query(
    `
      INSERT INTO j12_financeiro_despesas (
        id,
        descricao,
        categoria,
        valor,
        vencimento,
        pago_em,
        forma_pagamento,
        status,
        observacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      despesa.id,
      despesa.descricao,
      despesa.categoria,
      despesa.valor,
      despesa.vencimento,
      despesa.pagoEm,
      despesa.formaPagamento,
      despesa.status,
      despesa.observacao,
    ],
  );

  const rows = await query("SELECT * FROM j12_financeiro_despesas WHERE id = ? LIMIT 1", [
    despesa.id,
  ]);
  return mapExpenseRow(rows?.[0] ?? despesa);
}

async function getExpenseById(id) {
  await ensureExpenseTable();
  const rows = await query("SELECT * FROM j12_financeiro_despesas WHERE id = ? LIMIT 1", [
    sanitizeString(id, 64),
  ]);
  return Array.isArray(rows) && rows.length > 0 ? mapExpenseRow(rows[0]) : null;
}

async function updateExpenseRecord(id, payload) {
  await ensureExpenseTable();

  const despesaId = sanitizeString(id, 64);
  const descricao = sanitizeString(payload.descricao, 191);
  const valor = sanitizeNumber(payload.valor);
  if (!despesaId || !descricao || valor <= 0) {
    const error = new Error("Descricao e valor da despesa sao obrigatorios.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await getExpenseById(despesaId);
  if (!existing) {
    const error = new Error("Despesa nao encontrada.");
    error.statusCode = 404;
    throw error;
  }

  await query(
    `
      UPDATE j12_financeiro_despesas
      SET
        descricao = ?,
        categoria = ?,
        valor = ?,
        vencimento = ?,
        pago_em = ?,
        forma_pagamento = ?,
        status = ?,
        observacao = ?
      WHERE id = ?
    `,
    [
      descricao,
      normalizeExpenseCategory(payload.categoria),
      valor,
      sanitizeIsoDate(payload.vencimento) || null,
      sanitizeIsoDate(payload.pagoEm ?? payload.pago_em) || existing.pagoEm || null,
      sanitizeNullableString(payload.formaPagamento ?? payload.forma_pagamento, 50),
      sanitizeString(payload.status, 30) || existing.status || "pago",
      sanitizeNullableString(payload.observacao, 65535),
      despesaId,
    ],
  );

  return getExpenseById(despesaId);
}

async function deleteExpenseRecord(id) {
  await ensureExpenseTable();

  const despesaId = sanitizeString(id, 64);
  if (!despesaId) {
    const error = new Error("Informe uma despesa valida.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await getExpenseById(despesaId);
  if (!existing) {
    const error = new Error("Despesa nao encontrada.");
    error.statusCode = 404;
    throw error;
  }

  await query("DELETE FROM j12_financeiro_despesas WHERE id = ?", [despesaId]);
  return existing;
}

function calcResumo(charges, activeStudentsCount) {
  const summary = {
    totalAReceber: 0,
    totalRecebido: 0,
    totalAtrasado: 0,
    cobrancasPendentes: 0,
    alunosAtivos: activeStudentsCount,
  };

  for (const charge of charges) {
    const valor = Number(charge.valorFinal ?? charge.valor ?? 0) || 0;

    if (charge.status === "pago") {
      summary.totalRecebido += valor;
      continue;
    }

    if (charge.status === "cancelada") {
      continue;
    }

    summary.totalAReceber += valor;
    summary.cobrancasPendentes += 1;

    if (charge.status === "vencido") {
      summary.totalAtrasado += valor;
    }
  }

  return {
    ...summary,
    total_a_receber: Number(summary.totalAReceber.toFixed(2)),
    total_recebido: Number(summary.totalRecebido.toFixed(2)),
    total_atrasado: Number(summary.totalAtrasado.toFixed(2)),
    cobrancas_pendentes: summary.cobrancasPendentes,
    alunos_ativos: summary.alunosAtivos,
    totalAReceber: Number(summary.totalAReceber.toFixed(2)),
    totalRecebido: Number(summary.totalRecebido.toFixed(2)),
    totalAtrasado: Number(summary.totalAtrasado.toFixed(2)),
  };
}

function normalizeChargeStatus(status) {
  const normalized = sanitizeString(status, 30).toLowerCase();
  if (normalized === "vencido") return "atrasado";
  if (normalized === "cancelada") return "cancelado";
  return normalized || "pendente";
}

function toIsoDate(value) {
  const normalized = sanitizeIsoDate(value);
  if (normalized) return normalized;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function daysUntil(value) {
  const isoDate = toIsoDate(value);
  if (!isoDate) return null;

  const today = new Date();
  const target = new Date(`${isoDate}T00:00:00`);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((target.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));
}

function buildAutomationStatus(charges) {
  const pending = [];
  const overdue = [];
  const upcoming = [];

  for (const charge of charges) {
    const status = normalizeChargeStatus(charge.status);
    if (status === "pago" || status === "cancelado") continue;

    const dueIn = daysUntil(charge.vencimento ?? charge.data_vencimento);
    if (status === "atrasado" || (dueIn != null && dueIn < 0)) {
      overdue.push(charge);
      continue;
    }

    pending.push(charge);
    if (dueIn != null && dueIn >= 0 && dueIn <= 7) {
      upcoming.push(charge);
    }
  }

  const alertas = [
    {
      tipo: "mensalidades",
      titulo: "Geracao recorrente",
      descricao:
        "A rotina de mensalidades pode ser executada para criar cobrancas do ciclo atual sem duplicar registros existentes.",
      severidade: "success",
    },
    {
      tipo: "vencimentos",
      titulo: `${upcoming.length} vencimento(s) nos proximos 7 dias`,
      descricao:
        "Use este sinal para acionar lembretes por painel, WhatsApp ou e-mail quando as integracoes estiverem habilitadas.",
      severidade: upcoming.length > 0 ? "warning" : "info",
    },
    {
      tipo: "inadimplencia",
      titulo: `${overdue.length} cobranca(s) em atraso`,
      descricao:
        "A rotina de atualizacao de atrasadas marca cobrancas vencidas e apoia o fluxo de follow-up financeiro.",
      severidade: overdue.length > 0 ? "critical" : "success",
    },
  ];

  return {
    atrasadasAtualizadas: 0,
    mensalidadesPendentes: pending.length,
    proximosVencimentos: upcoming.length,
    inadimplentes: overdue.length,
    alertas,
  };
}

function buildMonthlyReport(charges) {
  const monthlyMap = new Map();
  const statusMap = new Map();
  const classMap = new Map();

  for (const charge of charges) {
    const competencia =
      sanitizeString(charge.competencia, 7) ||
      (toIsoDate(charge.vencimento ?? charge.data_vencimento) || "").slice(0, 7) ||
      "sem-data";
    const status = normalizeChargeStatus(charge.status);
    const turma = sanitizeString(charge.turma, 191) || "Sem turma";
    const value = sanitizeNumber(charge.valorFinal ?? charge.valor_final ?? charge.valor);

    const month = monthlyMap.get(competencia) || {
      competencia,
      recebido: 0,
      aberto: 0,
      atrasado: 0,
      quantidade: 0,
    };

    month.quantidade += 1;
    if (status === "pago") month.recebido += value;
    else if (status === "atrasado") {
      month.aberto += value;
      month.atrasado += value;
    } else if (status !== "cancelado") month.aberto += value;

    monthlyMap.set(competencia, month);
    statusMap.set(status, (statusMap.get(status) || 0) + 1);

    const classSummary = classMap.get(turma) || {
      turma,
      recebido: 0,
      aberto: 0,
      quantidade: 0,
    };
    classSummary.quantidade += 1;
    if (status === "pago") classSummary.recebido += value;
    else if (status !== "cancelado") classSummary.aberto += value;
    classMap.set(turma, classSummary);
  }

  const roundMoney = (item) => ({
    ...item,
    recebido: Number(item.recebido.toFixed(2)),
    aberto: Number(item.aberto.toFixed(2)),
    atrasado: typeof item.atrasado === "number" ? Number(item.atrasado.toFixed(2)) : item.atrasado,
  });

  return {
    geradoEm: new Date().toISOString(),
    porCompetencia: Array.from(monthlyMap.values())
      .map(roundMoney)
      .sort((a, b) => a.competencia.localeCompare(b.competencia)),
    porStatus: Array.from(statusMap.entries()).map(([status, quantidade]) => ({
      status,
      quantidade,
    })),
    porTurma: Array.from(classMap.values())
      .map(roundMoney)
      .sort((a, b) => b.aberto + b.recebido - (a.aberto + a.recebido)),
  };
}

async function getChargeById(id) {
  const rows = await query("SELECT * FROM j12_financeiro_cobrancas WHERE id = ? LIMIT 1", [
    sanitizeString(id, 64),
  ]);
  return Array.isArray(rows) && rows.length > 0 ? mapChargeRow(rows[0]) : null;
}

function normalizeTransacaoPayload(payload, existingId) {
  const alunoId = sanitizeString(payload.alunoId ?? payload.aluno_id, 64);
  const descricao = sanitizeString(payload.descricao, 191);

  if (!alunoId || !descricao) {
    const error = new Error("Aluno, descricao e vencimento sao obrigatorios.");
    error.statusCode = 400;
    throw error;
  }

  const vencimento = sanitizeIsoDate(payload.vencimento);
  if (!vencimento) {
    const error = new Error("Informe um vencimento valido no formato YYYY-MM-DD.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id: sanitizeString(existingId || payload.id, 64) || createId("f"),
    alunoId,
    alunoNome: sanitizeString(payload.alunoNome ?? payload.nome_aluno, 191) || "Aluno",
    numeroMatricula: sanitizeNullableString(
      payload.numeroMatricula ?? payload.numero_matricula,
      50,
    ),
    descricao,
    tipo: sanitizeString(payload.tipo || "mensalidade", 50) || "mensalidade",
    valor: sanitizeNumber(payload.valorFinal ?? payload.valor),
    vencimento,
    status:
      sanitizeIsoDate(payload.pagoEm ?? payload.dataPagamento) != null
        ? "pago"
        : normalizeDatabaseStatus(payload.status, vencimento),
    origem: normalizeOrigem(payload.origem),
    periodicidade: sanitizeNullableString(payload.periodicidade, 30) || "mensal",
    planoId: sanitizeNullableString(payload.planoId ?? payload.plano_id, 64),
    planoNome: sanitizeNullableString(payload.planoNome ?? payload.plano_nome, 191),
    modalidade: sanitizeNullableString(payload.modalidade, 191),
    turma: sanitizeNullableString(payload.turma, 191),
    unidade: sanitizeNullableString(payload.unidade, 191),
    responsavelFinanceiro: sanitizeNullableString(
      payload.responsavelFinanceiro ?? payload.responsavel_financeiro,
      191,
    ),
    responsavelCpf: sanitizeNullableString(payload.responsavelCpf ?? payload.responsavel_cpf, 20),
    telefoneWhatsapp: sanitizeNullableString(
      payload.telefoneWhatsapp ?? payload.telefone_whatsapp,
      50,
    ),
    email: sanitizeNullableString(payload.email, 191),
    observacao: sanitizeNullableString(payload.observacao, 65535),
    pagoEm: sanitizeIsoDate(payload.pagoEm),
    formaPagamento: sanitizeNullableString(payload.formaPagamento ?? payload.forma_pagamento, 50),
    dataGeracao:
      sanitizeIsoDate(payload.dataGeracao ?? payload.data_geracao) ||
      new Date().toISOString().slice(0, 10),
    dataPagamento: sanitizeIsoDate(payload.dataPagamento ?? payload.pagoEm),
    competencia: normalizeCompetencia(
      payload.competencia,
      sanitizeIsoDate(payload.vencimento) || new Date().toISOString().slice(0, 10),
    ),
    valorOriginal: sanitizeNumber(payload.valorOriginal ?? payload.valor_original ?? payload.valor),
    descontoValor: sanitizeNumber(payload.descontoValor ?? payload.desconto_valor),
    descontoPercentual: sanitizeNumber(payload.descontoPercentual ?? payload.desconto_percentual),
    bolsaValor: sanitizeNumber(payload.bolsaValor ?? payload.bolsa_valor),
    bolsaPercentual: sanitizeNumber(payload.bolsaPercentual ?? payload.bolsa_percentual),
    multaPercentual: sanitizeNumber(payload.multaPercentual ?? payload.multa_percentual),
    jurosDiaPercentual: sanitizeNumber(payload.jurosDiaPercentual ?? payload.juros_dia_percentual),
    valorFinal: sanitizeNumber(payload.valorFinal ?? payload.valor_final ?? payload.valor),
    tipoCobranca: mapTipoToChargeKind(payload.tipoCobranca ?? payload.tipo_cobranca),
    ativo: sanitizeBoolean(payload.ativo, true),
    alteradoEm: sanitizeNullableString(payload.alteradoEm ?? payload.alterado_em, 32),
    alteradoPor: sanitizeNullableString(payload.alteradoPor ?? payload.alterado_por, 191),
    cancelamentoMotivo: sanitizeNullableString(
      payload.cancelamentoMotivo ?? payload.cancelamento_motivo,
      65535,
    ),
    descontoMotivo: sanitizeNullableString(
      payload.descontoMotivo ?? payload.desconto_motivo,
      65535,
    ),
  };
}

function isManualFinanceStudentId(value) {
  const id = sanitizeString(value, 64).toLowerCase();
  return !id || id === "manual" || id.startsWith("manual-") || id.startsWith("avulso");
}

async function syncChargeCompatibilityWhenLinked(chargeId, alunoId) {
  if (isManualFinanceStudentId(alunoId)) {
    await removeChargeCompatibility(chargeId);
    return;
  }

  await syncChargeCompatibility(chargeId);
}

async function createCharge(transacao) {
  const insertValues = [
    transacao.id,
    transacao.alunoId,
    transacao.numeroMatricula,
    transacao.alunoNome,
    transacao.competencia,
    transacao.descricao,
    transacao.tipo,
    transacao.valor,
    transacao.vencimento,
    transacao.status,
    transacao.origem,
    transacao.periodicidade,
    transacao.planoId,
    transacao.planoNome,
    transacao.modalidade,
    transacao.turma,
    transacao.unidade,
    transacao.responsavelFinanceiro,
    transacao.responsavelCpf,
    transacao.telefoneWhatsapp,
    transacao.email,
    transacao.observacao,
    transacao.pagoEm,
    transacao.formaPagamento,
    transacao.dataGeracao,
    transacao.dataPagamento,
    transacao.valorOriginal,
    transacao.descontoValor,
    transacao.descontoPercentual,
    transacao.bolsaValor,
    transacao.bolsaPercentual,
    transacao.multaPercentual,
    transacao.jurosDiaPercentual,
    transacao.valorFinal,
    transacao.tipoCobranca,
    transacao.ativo ? 1 : 0,
    transacao.alteradoEm,
    transacao.alteradoPor,
    transacao.cancelamentoMotivo,
    transacao.descontoMotivo,
  ];

  await query(
    `
      INSERT INTO j12_financeiro_cobrancas (
        id, aluno_id, numero_matricula, nome_aluno, competencia, descricao, tipo, valor, vencimento,
        status, origem, periodicidade, plano_id, plano_nome, modalidade, turma, unidade,
        responsavel_financeiro, responsavel_cpf, telefone_whatsapp, email, observacao,
        pago_em, forma_pagamento, data_geracao, data_pagamento, valor_original,
        desconto_valor, desconto_percentual, bolsa_valor, bolsa_percentual, multa_percentual,
        juros_dia_percentual, valor_final, tipo_cobranca, ativo, alterado_em, alterado_por,
        cancelamento_motivo, desconto_motivo
      ) VALUES (${insertValues.map(() => "?").join(", ")})
    `,
    insertValues,
  );

  await syncChargeCompatibilityWhenLinked(transacao.id, transacao.alunoId);
  return getChargeById(transacao.id);
}

async function updateChargeRecord(transacao) {
  await query(
    `
      UPDATE j12_financeiro_cobrancas
      SET
        aluno_id = ?,
        numero_matricula = ?,
        nome_aluno = ?,
        competencia = ?,
        descricao = ?,
        tipo = ?,
        valor = ?,
        vencimento = ?,
        status = ?,
        origem = ?,
        periodicidade = ?,
        plano_id = ?,
        plano_nome = ?,
        modalidade = ?,
        turma = ?,
        unidade = ?,
        responsavel_financeiro = ?,
        responsavel_cpf = ?,
        telefone_whatsapp = ?,
        email = ?,
        observacao = ?,
        pago_em = ?,
        forma_pagamento = ?,
        data_geracao = ?,
        data_pagamento = ?,
        valor_original = ?,
        desconto_valor = ?,
        desconto_percentual = ?,
        bolsa_valor = ?,
        bolsa_percentual = ?,
        multa_percentual = ?,
        juros_dia_percentual = ?,
        valor_final = ?,
        tipo_cobranca = ?,
        ativo = ?,
        alterado_em = ?,
        alterado_por = ?,
        cancelamento_motivo = ?,
        desconto_motivo = ?
      WHERE id = ?
    `,
    [
      transacao.alunoId,
      transacao.numeroMatricula,
      transacao.alunoNome,
      transacao.competencia,
      transacao.descricao,
      transacao.tipo,
      transacao.valor,
      transacao.vencimento,
      transacao.status,
      transacao.origem,
      transacao.periodicidade,
      transacao.planoId,
      transacao.planoNome,
      transacao.modalidade,
      transacao.turma,
      transacao.unidade,
      transacao.responsavelFinanceiro,
      transacao.responsavelCpf,
      transacao.telefoneWhatsapp,
      transacao.email,
      transacao.observacao,
      transacao.pagoEm,
      transacao.formaPagamento,
      transacao.dataGeracao,
      transacao.dataPagamento,
      transacao.valorOriginal,
      transacao.descontoValor,
      transacao.descontoPercentual,
      transacao.bolsaValor,
      transacao.bolsaPercentual,
      transacao.multaPercentual,
      transacao.jurosDiaPercentual,
      transacao.valorFinal,
      transacao.tipoCobranca,
      transacao.ativo ? 1 : 0,
      transacao.alteradoEm,
      transacao.alteradoPor,
      transacao.cancelamentoMotivo,
      transacao.descontoMotivo,
      transacao.id,
    ],
  );

  await syncChargeCompatibilityWhenLinked(transacao.id, transacao.alunoId);
  return getChargeById(transacao.id);
}

async function resolveScopedCharges(req) {
  if (canManageSystem(req.auth)) {
    return listCharges();
  }

  const studentId = resolveScopedStudentId(req.auth);
  if (studentId) {
    return listCharges({ studentId });
  }

  const error = new Error("Seu perfil nao possui acesso ao financeiro geral.");
  error.statusCode = 403;
  throw error;
}

async function resolveActiveStudentCount(req) {
  if (canManageSystem(req.auth)) {
    const rows = await query(
      "SELECT COUNT(*) AS total FROM j12_alunos WHERE LOWER(status) = 'ativo'",
    );
    return Number(rows?.[0]?.total || 0);
  }

  const studentId = resolveScopedStudentId(req.auth);
  if (!studentId) return 0;

  const rows = await query(
    "SELECT COUNT(*) AS total FROM j12_alunos WHERE id = ? AND LOWER(status) = 'ativo'",
    [String(studentId)],
  );
  return Number(rows?.[0]?.total || 0);
}

router.use(requireAuth);

router.get("/resumo", async (req, res, next) => {
  try {
    const [charges, activeStudentsCount] = await Promise.all([
      resolveScopedCharges(req),
      resolveActiveStudentCount(req),
    ]);
    res.json(calcResumo(charges, activeStudentsCount));
  } catch (error) {
    next(error);
  }
});

router.get("/cobrancas", async (req, res, next) => {
  try {
    res.json(await resolveScopedCharges(req));
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    res.json(await resolveScopedCharges(req));
  } catch (error) {
    next(error);
  }
});

router.get("/automacoes/status", async (req, res, next) => {
  try {
    const charges = await resolveScopedCharges(req);
    res.json(buildAutomationStatus(charges));
  } catch (error) {
    next(error);
  }
});

router.post("/automacoes/executar", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem executar automacoes." });
    }

    const actorName = req.auth?.nome || req.auth?.email || "admin";
    const [updatedCount, monthlySummary] = await Promise.all([
      markOverdueCharges(actorName),
      generateMonthlyCharges({
        referenceCompetencia:
          req.body?.competencia ?? req.body?.referencia ?? req.body?.competency ?? undefined,
        actorName,
      }),
    ]);

    await syncAllChargeCompatibilityTables();
    const charges = await resolveScopedCharges(req);

    res.json({
      ok: true,
      atrasadasAtualizadas: updatedCount,
      mensalidadesCriadas: monthlySummary.created,
      mensalidadesIgnoradas: monthlySummary.skipped,
      competencia: monthlySummary.competencia,
      status: buildAutomationStatus(charges),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/despesas", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem listar despesas." });
    }

    res.json(await listExpenses());
  } catch (error) {
    next(error);
  }
});

router.post("/despesas", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem criar despesas." });
    }

    const saved = await createExpenseRecord(req.body ?? {});
    emitFinanceiroRealtime("despesa_criada", {
      expenseId: saved?.id,
      status: saved?.status,
    });
    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
});

router.put("/despesas/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem editar despesas." });
    }

    const saved = await updateExpenseRecord(req.params.id, req.body ?? {});
    emitFinanceiroRealtime("despesa_atualizada", {
      expenseId: saved?.id,
      status: saved?.status,
    });
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

router.delete("/despesas/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem excluir despesas." });
    }

    const deleted = await deleteExpenseRecord(req.params.id);
    emitFinanceiroRealtime("despesa_excluida", {
      expenseId: deleted.id,
      status: deleted.status,
    });
    res.json({ ok: true, deleted });
  } catch (error) {
    next(error);
  }
});

router.get("/relatorio-mensal", async (req, res, next) => {
  try {
    const charges = await resolveScopedCharges(req);
    res.json(buildMonthlyReport(charges));
  } catch (error) {
    next(error);
  }
});

router.post("/cobrancas", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem criar cobrancas." });
    }

    const transacao = normalizeTransacaoPayload(req.body);
    const saved = await createCharge(transacao);
    emitFinanceiroRealtime("cobranca_criada", {
      chargeId: saved?.id ?? transacao.id,
      studentId: saved?.alunoId ?? transacao.alunoId,
      status: saved?.status ?? transacao.status,
    });
    res.status(201).json(saved ?? transacao);
  } catch (error) {
    next(error);
  }
});

router.post("/cobrancas/:id/whatsapp", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem enviar cobrancas." });
    }

    const charge = await getChargeById(req.params.id);
    if (!charge) {
      return res.status(404).json({ message: "Cobranca nao encontrada." });
    }

    const result = await sendBotConversaChargeMessage(charge, req.body ?? {});
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem criar cobrancas." });
    }

    const transacao = normalizeTransacaoPayload(req.body);
    const saved = await createCharge(transacao);
    emitFinanceiroRealtime("cobranca_criada", {
      chargeId: saved?.id ?? transacao.id,
      studentId: saved?.alunoId ?? transacao.alunoId,
      status: saved?.status ?? transacao.status,
    });
    res.status(201).json(saved ?? transacao);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem editar cobrancas." });
    }

    const transacao = normalizeTransacaoPayload(req.body, req.params.id);
    const saved = await updateChargeRecord(transacao);
    emitFinanceiroRealtime("cobranca_atualizada", {
      chargeId: saved?.id ?? transacao.id,
      studentId: saved?.alunoId ?? transacao.alunoId,
      status: saved?.status ?? transacao.status,
    });
    res.json(saved ?? transacao);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem excluir cobrancas." });
    }

    await query("DELETE FROM j12_financeiro_cobrancas WHERE id = ?", [
      sanitizeString(req.params.id, 64),
    ]);
    await removeChargeCompatibility(req.params.id);
    emitFinanceiroRealtime("cobranca_excluida", {
      chargeId: sanitizeString(req.params.id, 64),
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.patch("/cobrancas/:id/pagar", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem baixar cobrancas." });
    }

    const dataRecebimento =
      sanitizeIsoDate(req.body?.pagoEm ?? req.body?.dataRecebimento) ||
      new Date().toISOString().slice(0, 10);
    const dataPagamento =
      sanitizeIsoDate(req.body?.dataPagamento) ||
      sanitizeIsoDate(req.body?.pagoEm) ||
      dataRecebimento;
    const valorRecebido = sanitizeNumber(
      req.body?.valorRecebido ?? req.body?.valor_recebido ?? req.body?.valorFinal ?? req.body?.valor,
    );
    const valorRecebidoParam = valorRecebido > 0 ? valorRecebido : null;
    const observacaoPagamento = sanitizeNullableString(
      req.body?.observacao ?? req.body?.observacaoPagamento,
      65535,
    );
    const notaPagamento = observacaoPagamento
      ? `Recebimento ${dataRecebimento}: ${observacaoPagamento}`
      : null;

    await query(
      `
        UPDATE j12_financeiro_cobrancas
        SET
          status = 'pago',
          pago_em = ?,
          data_pagamento = ?,
          forma_pagamento = ?,
          valor = COALESCE(?, valor),
          valor_final = COALESCE(?, valor_final),
          observacao = CASE
            WHEN ? IS NULL THEN observacao
            WHEN observacao IS NULL OR observacao = '' THEN ?
            ELSE CONCAT(observacao, CHAR(10), ?)
          END,
          alterado_em = NOW(),
          alterado_por = ?
        WHERE id = ?
      `,
      [
        dataRecebimento,
        dataPagamento,
        sanitizeNullableString(req.body?.formaPagamento ?? req.body?.forma_pagamento, 50) || null,
        valorRecebidoParam,
        valorRecebidoParam,
        notaPagamento,
        notaPagamento,
        notaPagamento,
        req.auth?.nome || req.auth?.email || "admin",
        sanitizeString(req.params.id, 64),
      ],
    );

    const saved = await getChargeById(req.params.id);
    if (!saved) {
      return res.status(404).json({ message: "Cobranca nao encontrada." });
    }
    await syncChargeCompatibilityWhenLinked(req.params.id, saved.alunoId);

    emitFinanceiroRealtime("cobranca_paga", {
      chargeId: saved.id,
      studentId: saved.alunoId,
      status: saved.status,
    });
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

router.patch("/cobrancas/:id/cancelar", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem cancelar cobrancas." });
    }

    await query(
      `
        UPDATE j12_financeiro_cobrancas
        SET
          status = 'cancelado',
          ativo = 0,
          cancelamento_motivo = ?,
          alterado_em = NOW(),
          alterado_por = ?
        WHERE id = ?
      `,
      [
        sanitizeNullableString(req.body?.motivo ?? req.body?.cancelamentoMotivo, 65535) ||
          "Cancelada manualmente.",
        req.auth?.nome || req.auth?.email || "admin",
        sanitizeString(req.params.id, 64),
      ],
    );

    const saved = await getChargeById(req.params.id);
    if (!saved) {
      return res.status(404).json({ message: "Cobranca nao encontrada." });
    }
    await syncChargeCompatibilityWhenLinked(req.params.id, saved.alunoId);

    emitFinanceiroRealtime("cobranca_cancelada", {
      chargeId: saved.id,
      studentId: saved.alunoId,
      status: saved.status,
    });
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

async function handleGenerateMonth(req, res, next) {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem gerar mensalidades." });
    }

    const summary = await generateMonthlyCharges({
      referenceCompetencia:
        req.body?.competencia ?? req.body?.referencia ?? req.body?.competency ?? undefined,
      actorName: req.auth?.nome || req.auth?.email || "admin",
    });
    await syncAllChargeCompatibilityTables();
    emitFinanceiroRealtime("mensalidades_geradas", {
      competencia: summary.competencia,
      createdCount: summary.created,
      skippedCount: summary.skipped,
    });

    return res.json({
      competencia: summary.competencia,
      createdCount: summary.created,
      skippedCount: summary.skipped,
      message:
        summary.created > 0
          ? `${summary.created} mensalidade(s) gerada(s) e ${summary.skipped} ignorada(s).`
          : `Nenhuma nova mensalidade foi criada. ${summary.skipped} registro(s) ja existiam ou estavam sem valor configurado.`,
    });
  } catch (error) {
    next(error);
  }
}

router.post("/gerar-mensalidade/:alunoId", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem gerar mensalidades." });
    }

    const result = await generateMonthlyChargeForStudent(req.params.alunoId, {
      referenceCompetencia: req.body?.competencia ?? req.body?.referencia ?? undefined,
      actorName: req.auth?.nome || req.auth?.email || "admin",
    });
    await syncChargeCompatibility(result.chargeId ?? "");
    emitFinanceiroRealtime("mensalidade_gerada", {
      chargeId: result.chargeId ?? null,
      studentId: sanitizeString(req.params.alunoId, 64),
      created: result.created,
      competencia: result.competencia,
    });

    res.json({
      competencia: result.competencia,
      created: result.created,
      skippedReason: result.skippedReason,
      chargeId: result.chargeId ?? null,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/gerar-mensalidades-mes", handleGenerateMonth);
router.post("/gerar-mensalidades", handleGenerateMonth);

router.post("/atualizar-atrasadas", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem atualizar cobrancas." });
    }

    const updatedCount = await markOverdueCharges(req.auth?.nome || req.auth?.email || "admin");
    emitFinanceiroRealtime("cobrancas_atrasadas_atualizadas", {
      updatedCount,
    });
    res.json({ ok: true, updatedCount });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
