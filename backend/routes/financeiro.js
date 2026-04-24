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

const router = express.Router();

function mapRowToTransacao(row) {
  return {
    id: row.id,
    alunoId: row.aluno_id,
    alunoNome: row.aluno_nome,
    descricao: row.descricao,
    tipo: row.tipo,
    valor: Number(row.valor ?? 0),
    vencimento: row.vencimento,
    pagoEm: row.pago_em,
    formaPagamento: row.forma_pagamento ?? undefined,
    observacao: row.observacao ?? undefined,
    responsavelFinanceiro: row.responsavel_financeiro ?? undefined,
    responsavelCpf: row.responsavel_cpf ?? undefined,
    telefoneWhatsapp: row.telefone_whatsapp ?? undefined,
    email: row.email ?? undefined,
    unidade: row.unidade ?? undefined,
    modalidade: row.modalidade ?? undefined,
    turma: row.turma ?? undefined,
    planoId: row.plano_id ?? null,
    planoNome: row.plano_nome ?? undefined,
    periodicidade: row.periodicidade ?? undefined,
    competencia: row.competencia ?? undefined,
    valorOriginal: Number(row.valor_original ?? 0),
    descontoValor: Number(row.desconto_valor ?? 0),
    descontoPercentual: Number(row.desconto_percentual ?? 0),
    bolsaValor: Number(row.bolsa_valor ?? 0),
    bolsaPercentual: Number(row.bolsa_percentual ?? 0),
    multaPercentual: Number(row.multa_percentual ?? 0),
    jurosDiaPercentual: Number(row.juros_dia_percentual ?? 0),
    valorFinal: Number(row.valor_final ?? row.valor ?? 0),
    dataGeracao: row.data_geracao ?? undefined,
    dataPagamento: row.data_pagamento ?? null,
    status: row.status ?? undefined,
    tipoCobranca: row.tipo_cobranca ?? undefined,
    origem: row.origem ?? undefined,
    ativo: Boolean(row.ativo),
    alteradoEm: row.alterado_em ?? null,
    alteradoPor: row.alterado_por ?? null,
    cancelamentoMotivo: row.cancelamento_motivo ?? null,
    descontoMotivo: row.desconto_motivo ?? null,
  };
}

function normalizeTransacaoPayload(payload, existingId) {
  const alunoId = sanitizeString(payload.alunoId, 64);
  const descricao = sanitizeString(payload.descricao);

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
    alunoNome: sanitizeString(payload.alunoNome, 191) || "Aluno",
    descricao,
    tipo: sanitizeString(payload.tipo || "mensalidade", 50) || "mensalidade",
    valor: sanitizeNumber(payload.valorFinal ?? payload.valor),
    vencimento,
    pagoEm: sanitizeIsoDate(payload.pagoEm),
    formaPagamento: sanitizeNullableString(payload.formaPagamento, 50),
    observacao: sanitizeNullableString(payload.observacao, 65535),
    responsavelFinanceiro: sanitizeNullableString(payload.responsavelFinanceiro, 191),
    responsavelCpf: sanitizeNullableString(payload.responsavelCpf, 20),
    telefoneWhatsapp: sanitizeNullableString(payload.telefoneWhatsapp, 50),
    email: sanitizeNullableString(payload.email, 191),
    unidade: sanitizeNullableString(payload.unidade, 191),
    modalidade: sanitizeNullableString(payload.modalidade, 191),
    turma: sanitizeNullableString(payload.turma, 191),
    planoId: sanitizeNullableString(payload.planoId, 64),
    planoNome: sanitizeNullableString(payload.planoNome, 191),
    periodicidade: sanitizeNullableString(payload.periodicidade, 30),
    competencia: sanitizeNullableString(payload.competencia, 32),
    valorOriginal: sanitizeNumber(payload.valorOriginal ?? payload.valor),
    descontoValor: sanitizeNumber(payload.descontoValor),
    descontoPercentual: sanitizeNumber(payload.descontoPercentual),
    bolsaValor: sanitizeNumber(payload.bolsaValor),
    bolsaPercentual: sanitizeNumber(payload.bolsaPercentual),
    multaPercentual: sanitizeNumber(payload.multaPercentual),
    jurosDiaPercentual: sanitizeNumber(payload.jurosDiaPercentual),
    valorFinal: sanitizeNumber(payload.valorFinal ?? payload.valor),
    dataGeracao: sanitizeIsoDate(payload.dataGeracao) || new Date().toISOString().slice(0, 10),
    dataPagamento: sanitizeIsoDate(payload.dataPagamento ?? payload.pagoEm),
    status: sanitizeNullableString(payload.status, 30),
    tipoCobranca: sanitizeNullableString(payload.tipoCobranca, 30),
    origem: sanitizeNullableString(payload.origem, 30),
    ativo: sanitizeBoolean(payload.ativo, true),
    alteradoEm: sanitizeNullableString(payload.alteradoEm, 32),
    alteradoPor: sanitizeNullableString(payload.alteradoPor, 191),
    cancelamentoMotivo: sanitizeNullableString(payload.cancelamentoMotivo, 65535),
    descontoMotivo: sanitizeNullableString(payload.descontoMotivo, 65535),
  };
}

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    if (canManageSystem(req.auth)) {
      const rows = await query("SELECT * FROM financeiro ORDER BY vencimento DESC, updated_at DESC");
      return res.json((Array.isArray(rows) ? rows : []).map(mapRowToTransacao));
    }

    const studentId = resolveScopedStudentId(req.auth);
    if (studentId) {
      const rows = await query(
        "SELECT * FROM financeiro WHERE aluno_id = ? ORDER BY vencimento DESC, updated_at DESC",
        [studentId],
      );
      return res.json((Array.isArray(rows) ? rows : []).map(mapRowToTransacao));
    }

    return res.status(403).json({ message: "Seu perfil nao possui acesso ao financeiro geral." });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Apenas administradores e coordenadores podem criar cobrancas." });
    }

    const transacao = normalizeTransacaoPayload(req.body);

    await query(
      `
        INSERT INTO financeiro (
          id, aluno_id, aluno_nome, descricao, tipo, valor, vencimento, pago_em, forma_pagamento,
          observacao, responsavel_financeiro, responsavel_cpf, telefone_whatsapp, email, unidade,
          modalidade, turma, plano_id, plano_nome, periodicidade, competencia, valor_original,
          desconto_valor, desconto_percentual, bolsa_valor, bolsa_percentual, multa_percentual,
          juros_dia_percentual, valor_final, data_geracao, data_pagamento, status, tipo_cobranca,
          origem, ativo, alterado_em, alterado_por, cancelamento_motivo, desconto_motivo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        transacao.id,
        transacao.alunoId,
        transacao.alunoNome,
        transacao.descricao,
        transacao.tipo,
        transacao.valor,
        transacao.vencimento,
        transacao.pagoEm,
        transacao.formaPagamento,
        transacao.observacao,
        transacao.responsavelFinanceiro,
        transacao.responsavelCpf,
        transacao.telefoneWhatsapp,
        transacao.email,
        transacao.unidade,
        transacao.modalidade,
        transacao.turma,
        transacao.planoId,
        transacao.planoNome,
        transacao.periodicidade,
        transacao.competencia,
        transacao.valorOriginal,
        transacao.descontoValor,
        transacao.descontoPercentual,
        transacao.bolsaValor,
        transacao.bolsaPercentual,
        transacao.multaPercentual,
        transacao.jurosDiaPercentual,
        transacao.valorFinal,
        transacao.dataGeracao,
        transacao.dataPagamento,
        transacao.status,
        transacao.tipoCobranca,
        transacao.origem,
        transacao.ativo ? 1 : 0,
        transacao.alteradoEm,
        transacao.alteradoPor,
        transacao.cancelamentoMotivo,
        transacao.descontoMotivo,
      ],
    );

    res.status(201).json(transacao);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Apenas administradores e coordenadores podem editar cobrancas." });
    }

    const transacao = normalizeTransacaoPayload(req.body, req.params.id);

    await query(
      `
        UPDATE financeiro SET
          aluno_id = ?, aluno_nome = ?, descricao = ?, tipo = ?, valor = ?, vencimento = ?, pago_em = ?,
          forma_pagamento = ?, observacao = ?, responsavel_financeiro = ?, responsavel_cpf = ?,
          telefone_whatsapp = ?, email = ?, unidade = ?, modalidade = ?, turma = ?, plano_id = ?,
          plano_nome = ?, periodicidade = ?, competencia = ?, valor_original = ?, desconto_valor = ?,
          desconto_percentual = ?, bolsa_valor = ?, bolsa_percentual = ?, multa_percentual = ?,
          juros_dia_percentual = ?, valor_final = ?, data_geracao = ?, data_pagamento = ?, status = ?,
          tipo_cobranca = ?, origem = ?, ativo = ?, alterado_em = ?, alterado_por = ?,
          cancelamento_motivo = ?, desconto_motivo = ?
        WHERE id = ?
      `,
      [
        transacao.alunoId,
        transacao.alunoNome,
        transacao.descricao,
        transacao.tipo,
        transacao.valor,
        transacao.vencimento,
        transacao.pagoEm,
        transacao.formaPagamento,
        transacao.observacao,
        transacao.responsavelFinanceiro,
        transacao.responsavelCpf,
        transacao.telefoneWhatsapp,
        transacao.email,
        transacao.unidade,
        transacao.modalidade,
        transacao.turma,
        transacao.planoId,
        transacao.planoNome,
        transacao.periodicidade,
        transacao.competencia,
        transacao.valorOriginal,
        transacao.descontoValor,
        transacao.descontoPercentual,
        transacao.bolsaValor,
        transacao.bolsaPercentual,
        transacao.multaPercentual,
        transacao.jurosDiaPercentual,
        transacao.valorFinal,
        transacao.dataGeracao,
        transacao.dataPagamento,
        transacao.status,
        transacao.tipoCobranca,
        transacao.origem,
        transacao.ativo ? 1 : 0,
        transacao.alteradoEm,
        transacao.alteradoPor,
        transacao.cancelamentoMotivo,
        transacao.descontoMotivo,
        transacao.id,
      ],
    );

    res.json(transacao);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!canManageSystem(req.auth)) {
      return res.status(403).json({ message: "Apenas administradores e coordenadores podem excluir cobrancas." });
    }

    await query("DELETE FROM financeiro WHERE id = ?", [sanitizeString(req.params.id, 64)]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
