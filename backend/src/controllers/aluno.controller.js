const { loadStudentRows } = require("./alunos.controller.js");
const { query } = require("../config/db.js");
const { gerarMensalidadeDoAluno } = require("../services/financeiro.service.js");
const { criarNotificacao } = require("../services/notificacao.service.js");

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value ?? fallback;

  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function text(value, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function resolveAlunoIdFromRequest(req) {
  const user = req.user || req.auth;

  if (!user) {
    const error = new Error("Token não informado ou inválido");
    error.statusCode = 401;
    throw error;
  }

  if (user.role !== "aluno" && user.perfil !== "aluno") {
    const error = new Error("Acesso permitido apenas para aluno");
    error.statusCode = 403;
    throw error;
  }

  const alunoId = user.aluno_id ?? user.studentId ?? user.alunoId ?? null;
  if (alunoId == null || String(alunoId).trim() === "") {
    const error = new Error("Aluno não vinculado ao usuário");
    error.statusCode = 404;
    throw error;
  }

  return String(alunoId);
}

async function getAlunoRelacionamentos(alunoId) {
  const rows = await query(
    `
      SELECT
        aluno.id,
        aluno.numero_matricula,
        aluno.nome_completo,
        aluno.data_nascimento,
        aluno.cpf,
        aluno.email_contato,
        aluno.telefone_contato,
        aluno.status,
        aluno.matricula_em,
        aluno.plano_id,
        aluno.turma_id,
        aluno.responsavel_id,
        aluno.modalidade_principal,
        aluno.turma_principal,
        aluno.plano_principal,
        aluno.unidade_principal,
        aluno.financeiro_json,
        plano.nome AS plano_nome,
        COALESCE(plano.valor, plano.preco_mensal) AS plano_valor,
        plano.modalidade AS plano_modalidade,
        plano.unidade AS plano_unidade,
        plano.status AS plano_status,
        turma.nome AS turma_nome,
        turma.modalidade AS turma_modalidade,
        turma.unidade AS turma_unidade,
        turma.professor_id AS turma_professor_id,
        COALESCE(turma.dias_semana, turma.horario) AS turma_dias_horarios,
        turma.status AS turma_status,
        responsavel.id AS responsavel_ref_id,
        responsavel.nome AS responsavel_nome_ref,
        responsavel.email AS responsavel_email_ref,
        responsavel.telefone AS responsavel_telefone_ref,
        responsavel.parentesco AS responsavel_parentesco_ref
      FROM j12_alunos aluno
      LEFT JOIN j12_planos plano ON plano.id = aluno.plano_id
      LEFT JOIN j12_turmas turma ON turma.id = aluno.turma_id
      LEFT JOIN j12_responsaveis responsavel ON responsavel.id = aluno.responsavel_id
      WHERE aluno.id = ?
      LIMIT 1
    `,
    [Number(alunoId)],
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function getMe(req, res, next) {
  try {
    const alunoId = resolveAlunoIdFromRequest(req);
    const { rows } = await loadStudentRows({ studentId: alunoId });
    const aluno = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!aluno) {
      return res.status(404).json({ message: "Aluno não vinculado ao usuário" });
    }

    const relacionamento = await getAlunoRelacionamentos(alunoId);
    const financeiro = parseJson(relacionamento?.financeiro_json, aluno.financeiro ?? null);

    return res.json({
      ...aluno,
      id: relacionamento?.id ?? aluno.id,
      numero_matricula: relacionamento?.numero_matricula ?? aluno.numeroMatricula ?? null,
      nome_completo: relacionamento?.nome_completo ?? aluno.nome ?? "",
      email_contato: relacionamento?.email_contato ?? aluno.email ?? "",
      telefone_contato: relacionamento?.telefone_contato ?? aluno.telefone ?? "",
      matricula_em: relacionamento?.matricula_em ?? aluno.matriculaEm ?? null,
      plano_id: relacionamento?.plano_id ?? null,
      turma_id: relacionamento?.turma_id ?? null,
      responsavel_id: relacionamento?.responsavel_id ?? null,
      financeiro,
      plano: aluno.plano || relacionamento?.plano_nome || relacionamento?.plano_principal || null,
      turma: aluno.turma || relacionamento?.turma_nome || relacionamento?.turma_principal || null,
      responsavel:
        aluno.responsavel || aluno.responsavel_nome || relacionamento?.responsavel_nome_ref || null,
      plano_detalhes: relacionamento?.plano_id
        ? {
            id: relacionamento.plano_id,
            nome: relacionamento.plano_nome,
            valor: Number(relacionamento.plano_valor || 0),
            modalidade: relacionamento.plano_modalidade,
            unidade: relacionamento.plano_unidade,
            status: relacionamento.plano_status,
          }
        : null,
      turma_detalhes: relacionamento?.turma_id
        ? {
            id: relacionamento.turma_id,
            nome: relacionamento.turma_nome,
            modalidade: relacionamento.turma_modalidade,
            unidade: relacionamento.turma_unidade,
            professor_id: relacionamento.turma_professor_id,
            dias_horarios: relacionamento.turma_dias_horarios,
            status: relacionamento.turma_status,
          }
        : null,
      responsavel_detalhes:
        relacionamento?.responsavel_ref_id || aluno.responsavel_nome
          ? {
              id: relacionamento?.responsavel_ref_id ?? aluno.responsavel_id ?? null,
              nome:
                relacionamento?.responsavel_nome_ref ??
                aluno.responsavel_nome ??
                aluno.responsavel ??
                null,
              email:
                relacionamento?.responsavel_email_ref ??
                aluno.responsavel_email ??
                aluno.responsavelEmail ??
                null,
              telefone:
                relacionamento?.responsavel_telefone_ref ??
                aluno.responsavel_whatsapp ??
                aluno.telefoneResponsavel ??
                null,
              parentesco:
                relacionamento?.responsavel_parentesco_ref ?? aluno.responsavel_parentesco ?? null,
            }
          : null,
      relacionamentos: {
        plano: relacionamento?.plano_id
          ? {
              id: relacionamento.plano_id,
              nome: relacionamento.plano_nome,
              valor: Number(relacionamento.plano_valor || 0),
              modalidade: relacionamento.plano_modalidade,
              unidade: relacionamento.plano_unidade,
              status: relacionamento.plano_status,
            }
          : null,
        turma: relacionamento?.turma_id
          ? {
              id: relacionamento.turma_id,
              nome: relacionamento.turma_nome,
              modalidade: relacionamento.turma_modalidade,
              unidade: relacionamento.turma_unidade,
              professor_id: relacionamento.turma_professor_id,
              dias_horarios: relacionamento.turma_dias_horarios,
              status: relacionamento.turma_status,
            }
          : null,
        responsavel:
          relacionamento?.responsavel_ref_id || aluno.responsavel_nome
            ? {
                id: relacionamento?.responsavel_ref_id ?? aluno.responsavel_id ?? null,
                nome:
                  relacionamento?.responsavel_nome_ref ??
                  aluno.responsavel_nome ??
                  aluno.responsavel ??
                  null,
                email:
                  relacionamento?.responsavel_email_ref ??
                  aluno.responsavel_email ??
                  aluno.responsavelEmail ??
                  null,
                telefone:
                  relacionamento?.responsavel_telefone_ref ??
                  aluno.responsavel_whatsapp ??
                  aluno.telefoneResponsavel ??
                  null,
                parentesco:
                  relacionamento?.responsavel_parentesco_ref ??
                  aluno.responsavel_parentesco ??
                  null,
              }
            : null,
      },
    });
  } catch (error) {
    next(error);
  }
}

function mapFinanceiroStatus(value, vencimento) {
  const normalized = text(value, 30).toLowerCase();
  if (normalized === "pago") return "pago";
  if (normalized === "cancelado") return "cancelado";

  const today = new Date().toISOString().slice(0, 10);
  if (normalized === "atrasado" || (normalized === "pendente" && vencimento < today)) {
    return "vencido";
  }

  return "pendente";
}

async function getMeFinanceiro(req, res, next) {
  try {
    const alunoId = resolveAlunoIdFromRequest(req);
    await gerarMensalidadeDoAluno(alunoId).catch(() => null);

    const rows = await query(
      `
        SELECT
          mensalidade.id,
          mensalidade.referencia AS competencia,
          mensalidade.data_vencimento AS vencimento,
          mensalidade.valor_final AS valor,
          mensalidade.status,
          mensalidade.forma_pagamento,
          COALESCE(mensalidade.data_pagamento, pagamento.data_pagamento) AS data_pagamento,
          plano.nome AS plano_nome,
          DATEDIFF(CURDATE(), mensalidade.data_vencimento) AS dias_em_atraso
        FROM j12_mensalidades mensalidade
        LEFT JOIN j12_planos plano ON plano.id = mensalidade.plano_id
        LEFT JOIN j12_pagamentos pagamento ON pagamento.mensalidade_id = mensalidade.id
        WHERE mensalidade.aluno_id = ?
        ORDER BY mensalidade.data_vencimento DESC, mensalidade.id DESC
      `,
      [Number(alunoId)],
    );

    const mensalidades = (Array.isArray(rows) ? rows : []).map((row) => {
      const status = mapFinanceiroStatus(row.status, row.vencimento);
      return {
        id: row.id,
        alunoId: String(alunoId),
        competencia: row.competencia,
        vencimento: row.vencimento,
        valor: Number(row.valor || 0),
        status,

        pix_copia_cola:
          "00020126580014BR.GOV.BCB.PIX5204000053039865405200.005802BR5920J12 SPORTS6009SAO PAULO62070503***6304ABCD",

        qr_code_pix: "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=PIX-J12",

        boleto_url: "https://www.boletobancario.com/boletofacil/exemplo.pdf",

        forma_pagamento: row.forma_pagamento,
        formaPagamento: row.forma_pagamento,
        data_pagamento: row.data_pagamento,
        dataPagamento: row.data_pagamento,
        plano_nome: row.plano_nome,
        planoNome: row.plano_nome,
        dias_em_atraso: status === "vencido" ? Math.max(Number(row.dias_em_atraso || 0), 0) : 0,
        valorFinal: Number(row.valor || 0),
        pagoEm: row.data_pagamento,
      };
    });

    const resumo = mensalidades.reduce(
      (acc, mensalidade) => {
        if (mensalidade.status === "pago") {
          acc.total_pago += mensalidade.valor;
        } else if (mensalidade.status === "vencido") {
          acc.total_vencido += mensalidade.valor;
        } else if (mensalidade.status === "pendente") {
          acc.total_pendente += mensalidade.valor;
        }

        if (
          mensalidade.status !== "pago" &&
          (!acc.proximo_vencimento || mensalidade.vencimento < acc.proximo_vencimento)
        ) {
          acc.proximo_vencimento = mensalidade.vencimento;
        }

        return acc;
      },
      {
        total_pendente: 0,
        total_pago: 0,
        total_vencido: 0,
        proximo_vencimento: null,
      },
    );

    const mensalidadeVencida = mensalidades.find((item) => item.status === "vencido");

    if (mensalidadeVencida) {
      await criarNotificacao({
        alunoId,
        titulo: "Mensalidade em atraso",
        mensagem: `Você possui uma mensalidade vencida no valor de R$ ${mensalidadeVencida.valor}`,
        tipo: "financeiro",
      });

      if (global.io) {
        global.io.emit("nova_notificacao", {
          alunoId,
          titulo: "Mensalidade em atraso",
        });
      }
    }

    res.json({
      resumo: {
        total_pendente: Number(resumo.total_pendente.toFixed(2)),
        total_pago: Number(resumo.total_pago.toFixed(2)),
        total_vencido: Number(resumo.total_vencido.toFixed(2)),
        proximo_vencimento: resumo.proximo_vencimento,
      },
      mensalidades,
    });
  } catch (error) {
    next(error);
  }
}

async function getMePresencas(req, res, next) {
  try {
    const alunoId = resolveAlunoIdFromRequest(req);
    const rows = await query(
      `
        SELECT
          presenca.id,
          presenca.data_aula,
          presenca.status,
          presenca.observacao,
          turma.nome AS turma_nome
        FROM j12_presencas presenca
        LEFT JOIN j12_turmas turma ON turma.id = presenca.turma_id
        WHERE presenca.aluno_id = ?
        ORDER BY presenca.data_aula DESC, presenca.id DESC
      `,
      [String(alunoId)],
    );

    const presencas = (Array.isArray(rows) ? rows : []).map((row) => ({
      id: row.id,
      alunoId: String(alunoId),
      data_aula: row.data_aula,
      dataAula: row.data_aula,
      status: row.status,
      presente: row.status === "presente",
      observacao: row.observacao,
      turma_nome: row.turma_nome,
      turma: row.turma_nome,
      modalidade: "",
    }));

    const totalAulas = presencas.length;
    const presentes = presencas.filter((item) => item.status === "presente").length;
    const faltas = presencas.filter((item) => item.status === "falta").length;
    const justificadas = presencas.filter((item) => item.status === "justificada").length;

    res.json({
      resumo: {
        total_aulas: totalAulas,
        presentes,
        faltas,
        justificadas,
        percentual_presenca:
          totalAulas > 0 ? Number(((presentes / totalAulas) * 100).toFixed(2)) : 0,
      },
      presencas,
    });
  } catch (error) {
    next(error);
  }
}

async function getMeDashboardResponsavel(req, res) {
  try {
    res.json({
      aluno: {
        nome: "Orlando",
      },

      financeiro: {
        mensalidade: 200,
        status: "Em dia",
      },

      presenca: {
        percentual: 92,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Erro ao carregar dashboard",
    });
  }
}

async function getMeNotificacoes(req, res, next) {
  try {
    const alunoId = resolveAlunoIdFromRequest(req);
    const rows = await query(
      `
        SELECT id, aluno_id, titulo, mensagem, tipo, lida, created_at
        FROM j12_notificacoes
        WHERE aluno_id = ?
        ORDER BY created_at DESC, id DESC
      `,
      [String(alunoId)],
    );

    if (global.io) {
      global.io.emit("nova_notificacao", {
        titulo: "Teste realtime",
      });
    }

    res.json(
      (Array.isArray(rows) ? rows : []).map((row) => ({
        id: row.id,
        aluno_id: row.aluno_id,
        alunoId: String(row.aluno_id),
        titulo: row.titulo,
        mensagem: row.mensagem,
        tipo: row.tipo,
        lida: Boolean(row.lida),
        canal: "painel",
        created_at: row.created_at,
        createdAt: row.created_at,
      })),
    );
  } catch (error) {
    next(error);
  }
}

async function getMeContrato(req, res, next) {
  try {
    const alunoId = resolveAlunoIdFromRequest(req);
    const rows = await query(
      `
        SELECT id, aluno_id, titulo, status, url_arquivo, aceite_em, created_at
        FROM j12_contratos
        WHERE aluno_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [String(alunoId)],
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.json({
        status: "nao_encontrado",
        message: "Nenhum contrato encontrado para este aluno.",
      });
    }

    const row = rows[0];
    return res.json({
      id: row.id,
      aluno_id: row.aluno_id,
      alunoId: String(row.aluno_id),
      titulo: row.titulo,
      status: row.status,
      url_arquivo: row.url_arquivo,
      aceite_em: row.aceite_em,
      created_at: row.created_at,
      tipoDocumento: "contrato_aluno",
      arquivoPdf: row.url_arquivo,
      templateHtml: "",
      dataEmissao: row.created_at,
      dataAssinatura: row.aceite_em,
      observacoes: "",
    });
  } catch (error) {
    next(error);
  }
}

async function getMeDashboard(req, res) {
  try {
    res.json({
      nome: "Orlando",

      financeiro: {
        mensalidade: 200,
      },

      presenca: {
        percentual: 92,
      },

      plano: {
        nome: "Futsal Kids",
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Erro ao carregar dashboard",
    });
  }
}

async function marcarNotificacaoComoLida(req, res, next) {
  try {
    const alunoId = resolveAlunoIdFromRequest(req);

    const { id } = req.params;

    await query(
      `
        UPDATE j12_notificacoes
        SET lida = 1
        WHERE id = ?
        AND aluno_id = ?
      `,
      [Number(id), Number(alunoId)],
    );

    res.json({
      success: true,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMe,
  getMeFinanceiro,
  getMePresencas,
  getMeNotificacoes,
  getMeContrato,
  getMeDashboard,
  getMeDashboardResponsavel,
  marcarNotificacaoComoLida,
};
