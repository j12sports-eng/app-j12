import { apiFetch } from "./api";

export type StatusMensalidade = "pendente" | "pago" | "vencido" | "parcial" | "cancelado";

export type FormaPagamento = "pix" | "cartao" | "dinheiro" | "boleto" | "transferencia" | "outro";

export type Mensalidade = {
  id: number;
  aluno_id: number;
  plano_id?: number | null;
  descricao?: string | null;
  competencia: string;
  valor_original: number;
  valor_atualizado: number;
  data_vencimento: string;
  status: StatusMensalidade;
  forma_pagamento?: string | null;
  data_pagamento?: string | null;
  observacao?: string | null;
  aluno_nome?: string | null;
  aluno_nome_alternativo?: string | null;
  plano_nome?: string | null;
};

export type ResumoFinanceiro = {
  competencia: string;
  recebido_mes: number;
  a_receber_mes: number;
  vencido_total: number;
  inadimplentes: number;
  total_mensalidades_mes: number;
  mensalidades_pendentes: number;
  mensalidades_pagas: number;
  mensalidades_vencidas: number;
};

export type GerarMensalidadesResponse = {
  message: string;
  total_alunos: number;
  geradas: number;
  ignoradas: number;
  erros: Array<{
    aluno_id: number;
    aluno_nome: string;
    erro: string;
  }>;
};

export type FiltrosMensalidades = {
  competencia?: string;
  status?: StatusMensalidade | "";
  aluno_id?: number | string;
};

export type PagarMensalidadePayload = {
  valor_pago: number;
  forma_pagamento: FormaPagamento;
  data_pagamento?: string;
  observacao?: string;
};

function buildQuery(filtros?: FiltrosMensalidades) {
  const params = new URLSearchParams();

  if (filtros?.competencia) params.set("competencia", filtros.competencia);
  if (filtros?.status) params.set("status", filtros.status);
  if (filtros?.aluno_id) params.set("aluno_id", String(filtros.aluno_id));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function carregarResumoFinanceiro(competencia?: string): Promise<ResumoFinanceiro> {
  const query = competencia ? `?competencia=${encodeURIComponent(competencia)}` : "";

  return apiFetch<ResumoFinanceiro>(`/financeiro/resumo${query}`);
}

export async function listarMensalidades(filtros?: FiltrosMensalidades): Promise<Mensalidade[]> {
  const data = await apiFetch<Mensalidade[]>(`/financeiro/mensalidades${buildQuery(filtros)}`);

  return Array.isArray(data) ? data : [];
}

export async function gerarMensalidades(competencia: string): Promise<GerarMensalidadesResponse> {
  return apiFetch<GerarMensalidadesResponse>("/financeiro/gerar-mensalidades", {
    method: "POST",
    body: JSON.stringify({ competencia }),
  });
}

export async function marcarMensalidadePaga(
  id: number | string,
  payload: PagarMensalidadePayload,
): Promise<{ message: string; status: StatusMensalidade }> {
  return apiFetch<{ message: string; status: StatusMensalidade }>(
    `/financeiro/mensalidades/${id}/pagar`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function atualizarMensalidade(
  id: number | string,
  payload: Partial<Mensalidade>,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/financeiro/mensalidades/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function excluirMensalidade(id: number | string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/financeiro/mensalidades/${id}`, {
    method: "DELETE",
  });
}

export function moedaBR(valor: number | string | null | undefined) {
  const numero = Number(valor || 0);

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function competenciaAtual() {
  return new Date().toISOString().slice(0, 7);
}
