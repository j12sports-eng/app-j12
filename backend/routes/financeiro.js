const express = require("express");
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

  await syncChargeCompatibility(transacao.id);
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

  await syncChargeCompatibility(transacao.id);
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

router.post("/cobrancas", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res
        .status(403)
        .json({ message: "Apenas administradores e coordenadores podem criar cobrancas." });
    }

    const transacao = normalizeTransacaoPayload(req.body);
    const saved = await createCharge(transacao);
    res.status(201).json(saved ?? transacao);
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

    await query(
      `
        UPDATE j12_financeiro_cobrancas
        SET
          status = 'pago',
          pago_em = ?,
          data_pagamento = ?,
          forma_pagamento = ?,
          alterado_em = NOW(),
          alterado_por = ?
        WHERE id = ?
      `,
      [
        sanitizeIsoDate(req.body?.pagoEm) || new Date().toISOString().slice(0, 10),
        sanitizeIsoDate(req.body?.dataPagamento) ||
          sanitizeIsoDate(req.body?.pagoEm) ||
          new Date().toISOString().slice(0, 10),
        sanitizeNullableString(req.body?.formaPagamento ?? req.body?.forma_pagamento, 50) || null,
        req.auth?.nome || req.auth?.email || "admin",
        sanitizeString(req.params.id, 64),
      ],
    );

    await syncChargeCompatibility(req.params.id);
    const saved = await getChargeById(req.params.id);
    if (!saved) {
      return res.status(404).json({ message: "Cobranca nao encontrada." });
    }

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

    await syncChargeCompatibility(req.params.id);
    const saved = await getChargeById(req.params.id);
    if (!saved) {
      return res.status(404).json({ message: "Cobranca nao encontrada." });
    }

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
    res.json({ ok: true, updatedCount });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
