import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { ensureSocketConnected, socket } from "@/lib/socket";

type ResumoApi = {
  total_a_receber?: number;
  total_recebido?: number;
  total_atrasado?: number;
  cobrancas_pendentes?: number;
  totalAReceber?: number;
  totalRecebido?: number;
  totalAtrasado?: number;
};

type CobrancaApi = {
  id: string;
  alunoNome?: string;
  alunoId?: string;
  aluno_id?: string;
  valor?: number;
  valorFinal?: number;
  valorOriginal?: number;
  descontoValor?: number;
  descontoPercentual?: number;
  multaPercentual?: number;
  jurosDiaPercentual?: number;
  status: string;
  vencimento: string;
  competencia?: string;
  descricao?: string;
  tipo?: string;
  tipoCobranca?: string;
  periodicidade?: string;
  planoId?: string | null;
  planoNome?: string;
  modalidade?: string;
  turma?: string;
  unidade?: string;
  responsavelFinanceiro?: string;
  telefoneWhatsapp?: string;
  email?: string;
  observacao?: string;
  pagoEm?: string | null;
  dataPagamento?: string | null;
  formaPagamento?: string;
};

type Resumo = {
  recebido_mes: number;
  a_receber_mes: number;
  inadimplentes: number;
  mensalidades_vencidas: number;
  total_recebido: number;
  total_a_receber: number;
  total_atrasado: number;
};

export type Mensalidade = {
  id: string;
  aluno_nome: string;
  aluno_id: string;
  descricao: string;
  tipo: string;
  tipo_cobranca: string;
  periodicidade?: string;
  valor_atualizado: number;
  valor_original: number;
  desconto_valor: number;
  desconto_percentual: number;
  multa_percentual: number;
  juros_dia_percentual: number;
  status: string;
  data_vencimento: string;
  competencia: string;
  plano_id?: string | null;
  plano_nome?: string;
  modalidade?: string;
  turma?: string;
  unidade?: string;
  responsavel_financeiro?: string;
  telefone_whatsapp?: string;
  email?: string;
  observacao?: string;
  pago_em?: string | null;
  data_pagamento?: string | null;
  forma_pagamento?: string;
};

export type CriarCobrancaPayload = {
  alunoId: string;
  alunoNome?: string;
  planoId?: string | null;
  planoNome?: string;
  numeroMatricula?: string;
  modalidade?: string;
  turma?: string;
  unidade?: string;
  responsavelFinanceiro?: string;
  telefoneWhatsapp?: string;
  email?: string;
  tipo: string;
  tipoCobranca: string;
  descricao: string;
  valorOriginal: number;
  descontoValor: number;
  descontoPercentual: number;
  valorFinal: number;
  valor: number;
  vencimento: string;
  competencia: string;
  multaPercentual: number;
  jurosDiaPercentual: number;
  multaTipo?: "percentual" | "fixo";
  multaValor?: number;
  jurosTipo?: "percentual" | "fixo";
  jurosValor?: number;
  encargosTipo?: "percentual" | "fixo";
  encargosPercentual?: number;
  encargosValor?: number;
  periodicidade?: string;
  formaPagamento?: string;
  origem?: "manual" | "automatica";
  status?: string;
  pagoEm?: string;
  dataPagamento?: string;
  gerarPix?: boolean;
  observacao?: string;
};

export type DespesaFinanceira = {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  vencimento?: string | null;
  pagoEm?: string | null;
  formaPagamento?: string | null;
  status: string;
  observacao?: string | null;
};

export type SalvarDespesaPayload = {
  descricao: string;
  categoria: string;
  valor: number;
  vencimento?: string | null;
  pagoEm?: string | null;
  formaPagamento?: string | null;
  status?: string;
  observacao?: string | null;
};

export type ReceberMensalidadePayload = {
  formaPagamento?: string;
  pagoEm?: string;
  dataPagamento?: string;
  valorRecebido?: number;
  observacao?: string;
};

type CategoriaResumo = {
  categoria: string;
  label: string;
  valor: number;
};

type FluxoCaixa = {
  entradas: number;
  saidas: number;
  lucroLiquido: number;
  saldoOperacional: number;
  entradasPorCategoria: CategoriaResumo[];
  saidasPorCategoria: CategoriaResumo[];
};

type AutomacaoFinanceira = {
  atrasadasAtualizadas: number;
  mensalidadesPendentes: number;
  proximosVencimentos: number;
  inadimplentes: number;
  alertas: Array<{
    tipo: string;
    titulo: string;
    descricao: string;
    severidade: "info" | "warning" | "critical" | "success";
  }>;
};

function isOverdueStatus(status: string) {
  return ["vencido", "atrasado"].includes(String(status || "").toLowerCase());
}

function normalizeResumo(resumo: ResumoApi | null, mensalidades: Mensalidade[]): Resumo {
  const totalRecebido = Number(resumo?.total_recebido ?? resumo?.totalRecebido ?? 0);
  const totalAReceber = Number(resumo?.total_a_receber ?? resumo?.totalAReceber ?? 0);
  const totalAtrasado = Number(resumo?.total_atrasado ?? resumo?.totalAtrasado ?? 0);

  return {
    recebido_mes: totalRecebido,
    a_receber_mes: totalAReceber,
    inadimplentes: mensalidades.filter((item) => isOverdueStatus(item.status)).length,
    mensalidades_vencidas: mensalidades.filter((item) => isOverdueStatus(item.status)).length,
    total_recebido: totalRecebido,
    total_a_receber: totalAReceber,
    total_atrasado: totalAtrasado,
  };
}

function normalizeMensalidades(items: CobrancaApi[]): Mensalidade[] {
  return items.map((item) => ({
    id: String(item.id),
    aluno_id: String(item.alunoId ?? item.aluno_id ?? ""),
    aluno_nome: item.alunoNome || "Aluno",
    valor_atualizado: Number(item.valorFinal ?? item.valor ?? 0),
    valor_original: Number(item.valorOriginal ?? item.valor ?? 0),
    desconto_valor: Number(item.descontoValor ?? 0),
    desconto_percentual: Number(item.descontoPercentual ?? 0),
    multa_percentual: Number(item.multaPercentual ?? 0),
    juros_dia_percentual: Number(item.jurosDiaPercentual ?? 0),
    status: item.status,
    data_vencimento: item.vencimento,
    competencia: item.competencia || "",
    descricao: item.descricao || "Cobranca J12",
    tipo: item.tipo || "mensalidade",
    tipo_cobranca: item.tipoCobranca || "avulsa",
    periodicidade: item.periodicidade,
    plano_id: item.planoId ?? null,
    plano_nome: item.planoNome,
    modalidade: item.modalidade,
    turma: item.turma,
    unidade: item.unidade,
    responsavel_financeiro: item.responsavelFinanceiro,
    telefone_whatsapp: item.telefoneWhatsapp,
    email: item.email,
    observacao: item.observacao,
    pago_em: item.pagoEm ?? null,
    data_pagamento: item.dataPagamento ?? null,
    forma_pagamento: item.formaPagamento,
  }));
}

function normalizeDespesa(item: Partial<DespesaFinanceira>): DespesaFinanceira {
  return {
    id: String(item.id ?? ""),
    descricao: String(item.descricao ?? "Despesa operacional"),
    categoria: String(item.categoria ?? "outros"),
    valor: Number(item.valor || 0),
    vencimento: item.vencimento ?? null,
    pagoEm: item.pagoEm ?? null,
    formaPagamento: item.formaPagamento ?? null,
    status: String(item.status ?? "pago"),
    observacao: item.observacao ?? null,
  };
}

const ENTRADAS_LABELS: Record<string, string> = {
  mensalidade: "Mensalidades",
  matricula: "Matriculas",
  uniforme: "Uniformes",
  arena: "Arena",
  evento: "Eventos",
};

const SAIDAS_LABELS: Record<string, string> = {
  aluguel: "Aluguel",
  iptu: "IPTU",
  funcionarios: "Funcionarios",
  pedreiro: "Pedreiro",
  prestadores_servico: "Prestadores de servico",
  manutencao: "Manutencao",
  reformas: "Reformas",
  eletricista: "Eletricista",
  encanador: "Encanador",
  limpeza: "Limpeza",
  fornecedores_gerais: "Fornecedores gerais",
  impostos: "Impostos",
  contas_operacionais: "Contas operacionais",
};

function buildCategorySummary(
  labels: Record<string, string>,
  values: Map<string, number>,
): CategoriaResumo[] {
  return Object.entries(labels).map(([categoria, label]) => ({
    categoria,
    label,
    valor: Number((values.get(categoria) || 0).toFixed(2)),
  }));
}

function buildFluxoCaixa(mensalidades: Mensalidade[], despesas: DespesaFinanceira[]): FluxoCaixa {
  const entradasMap = new Map<string, number>();
  const saidasMap = new Map<string, number>();
  let entradas = 0;
  let carteiraAberta = 0;
  let saidas = 0;

  for (const item of mensalidades) {
    const value = Number(item.valor_atualizado || 0);
    const category = String(item.tipo || "mensalidade").toLowerCase();
    const status = String(item.status || "").toLowerCase();

    if (status === "pago") {
      entradas += value;
      entradasMap.set(category, (entradasMap.get(category) || 0) + value);
    } else if (!["cancelado", "cancelada"].includes(status)) {
      carteiraAberta += value;
    }
  }

  for (const despesa of despesas) {
    const status = String(despesa.status || "").toLowerCase();
    if (status === "cancelado" || status === "cancelada") continue;

    const value = Number(despesa.valor || 0);
    saidas += value;
    saidasMap.set(despesa.categoria, (saidasMap.get(despesa.categoria) || 0) + value);
  }

  const lucroLiquido = entradas - saidas;

  return {
    entradas: Number(entradas.toFixed(2)),
    saidas: Number(saidas.toFixed(2)),
    lucroLiquido: Number(lucroLiquido.toFixed(2)),
    saldoOperacional: Number((lucroLiquido + carteiraAberta).toFixed(2)),
    entradasPorCategoria: buildCategorySummary(ENTRADAS_LABELS, entradasMap),
    saidasPorCategoria: buildCategorySummary(SAIDAS_LABELS, saidasMap),
  };
}

export function useFinanceiroAdmin() {
  const [resumo, setResumo] = useState<Resumo | null>(null);

  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [automacao, setAutomacao] = useState<AutomacaoFinanceira | null>(null);
  const [despesas, setDespesas] = useState<DespesaFinanceira[]>([]);
  const [fluxoCaixa, setFluxoCaixa] = useState<FluxoCaixa>(() => buildFluxoCaixa([], []));

  async function carregar() {
    try {
      setLoading(true);
      setError(null);

      const [resumoResponse, cobrancasResponse, automacaoResponse] = await Promise.all([
        api.get<ResumoApi>("/financeiro/resumo"),
        api.get<CobrancaApi[]>("/financeiro"),
        api.get<AutomacaoFinanceira>("/financeiro/automacoes/status").catch(() => null),
      ]);
      const despesasResponse = await api
        .get<DespesaFinanceira[]>("/financeiro/despesas")
        .catch(() => []);

      const nextMensalidades = normalizeMensalidades(
        Array.isArray(cobrancasResponse) ? cobrancasResponse : [],
      );
      const nextDespesas = (Array.isArray(despesasResponse) ? despesasResponse : []).map(
        normalizeDespesa,
      );

      setMensalidades(nextMensalidades);
      setDespesas(nextDespesas);
      setResumo(normalizeResumo(resumoResponse, nextMensalidades));
      setAutomacao(automacaoResponse);
      setFluxoCaixa(buildFluxoCaixa(nextMensalidades, nextDespesas));
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Erro ao carregar financeiro");
    } finally {
      setLoading(false);
    }
  }

  async function receberMensalidade(
    id: string,
    payload: ReceberMensalidadePayload | string = "pix",
  ) {
    try {
      setActionLoading(true);
      setError(null);
      setMessage(null);
      const body =
        typeof payload === "string"
          ? { formaPagamento: payload }
          : {
              formaPagamento: payload.formaPagamento || "pix",
              pagoEm: payload.pagoEm,
              dataPagamento: payload.dataPagamento ?? payload.pagoEm,
              valorRecebido: payload.valorRecebido,
              observacao: payload.observacao,
            };

      await api.patch(`/financeiro/cobrancas/${id}/pagar`, body);

      await carregar();
      setMessage("Pagamento confirmado e dashboard atualizado.");
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Erro ao confirmar pagamento");
      throw error;
    } finally {
      setActionLoading(false);
    }
  }

  async function criarCobranca(payload: CriarCobrancaPayload) {
    try {
      setActionLoading(true);
      setError(null);
      setMessage(null);

      const created = await api.post<CobrancaApi>("/financeiro/cobrancas", payload);
      let pixMessage = "";
      let pixPayload: unknown = null;

      if (payload.gerarPix && payload.formaPagamento === "pix") {
        pixPayload = await api.post("/pix/create", {
          chargeId: created.id,
          mensalidadeId: created.id,
        });
        pixMessage = " PIX Banco Inter gerado.";
      }

      await api
        .post(`/financeiro/cobrancas/${created.id}/whatsapp`, {
          pix: pixPayload,
          origem: "j12_pay_modal",
        })
        .catch(() => null);

      await carregar();
      setMessage(`Cobranca criada com sucesso.${pixMessage} WhatsApp automatico processado.`);
      return { created, pix: pixPayload };
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Erro ao criar cobranca");
      throw error;
    } finally {
      setActionLoading(false);
    }
  }

  async function atualizarCobranca(id: string, payload: CriarCobrancaPayload) {
    try {
      setActionLoading(true);
      setError(null);
      setMessage(null);

      const updated = await api.put<CobrancaApi>(`/financeiro/${id}`, payload);

      await carregar();
      setMessage("Cobranca atualizada com sucesso.");
      return updated;
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Erro ao atualizar cobranca");
      throw error;
    } finally {
      setActionLoading(false);
    }
  }

  async function excluirCobranca(id: string) {
    try {
      setActionLoading(true);
      setError(null);
      setMessage(null);

      await api.del(`/financeiro/${id}`);

      await carregar();
      setMessage("Cobranca excluida com sucesso.");
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Erro ao excluir cobranca");
      throw error;
    } finally {
      setActionLoading(false);
    }
  }

  async function criarDespesa(payload: SalvarDespesaPayload) {
    try {
      setActionLoading(true);
      setError(null);
      setMessage(null);

      const created = await api.post<DespesaFinanceira>("/financeiro/despesas", payload);

      await carregar();
      setMessage("Despesa criada com sucesso.");
      return created;
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Erro ao criar despesa");
      throw error;
    } finally {
      setActionLoading(false);
    }
  }

  async function atualizarDespesa(id: string, payload: SalvarDespesaPayload) {
    try {
      setActionLoading(true);
      setError(null);
      setMessage(null);

      const updated = await api.put<DespesaFinanceira>(`/financeiro/despesas/${id}`, payload);

      await carregar();
      setMessage("Despesa atualizada com sucesso.");
      return updated;
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Erro ao atualizar despesa");
      throw error;
    } finally {
      setActionLoading(false);
    }
  }

  async function excluirDespesa(id: string) {
    try {
      setActionLoading(true);
      setError(null);
      setMessage(null);

      await api.del(`/financeiro/despesas/${id}`);

      await carregar();
      setMessage("Despesa excluida com sucesso.");
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Erro ao excluir despesa");
      throw error;
    } finally {
      setActionLoading(false);
    }
  }

  async function gerarMensalidades() {
    try {
      setActionLoading(true);
      setError(null);
      setMessage(null);
      const competencia = new Date().toISOString().slice(0, 7);

      await api.post("/financeiro/gerar-mensalidades", {
        competencia,
      });

      await carregar();
      setMessage("Rotina de mensalidades executada com sucesso.");
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Erro ao gerar mensalidades");
    } finally {
      setActionLoading(false);
    }
  }

  async function atualizarAtrasadas() {
    try {
      setActionLoading(true);
      setError(null);
      setMessage(null);

      const response = await api.post<{
        updatedCount?: number;
      }>("/financeiro/atualizar-atrasadas");

      await carregar();
      setMessage(`${response?.updatedCount || 0} cobranca(s) atrasada(s) atualizada(s).`);
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Erro ao atualizar atrasadas");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    ensureSocketConnected();
    const refresh = () => {
      void carregar();
    };

    socket.on("financeiro:cobranca-atualizada", refresh);
    socket.on("financeiro:pagamento-atualizado", refresh);
    socket.on("dashboard:financeiro-atualizado", refresh);

    return () => {
      socket.off("financeiro:cobranca-atualizada", refresh);
      socket.off("financeiro:pagamento-atualizado", refresh);
      socket.off("dashboard:financeiro-atualizado", refresh);
    };
  }, []);

  return {
    resumo,
    mensalidades,
    loading,
    actionLoading,
    error,
    message,
    automacao,
    despesas,
    fluxoCaixa,
    atualizar: carregar,
    receberMensalidade,
    criarCobranca,
    atualizarCobranca,
    excluirCobranca,
    criarDespesa,
    atualizarDespesa,
    excluirDespesa,
    gerarMensalidades,
    atualizarAtrasadas,
  };
}
