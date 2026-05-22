import type { CriarCobrancaPayload } from "@/hooks/useFinanceiroAdmin";

export type AlunoOption = {
  id: string | number;
  nome?: string;
  nome_completo?: string;
  avatar?: string;
  foto?: string;
  foto_url?: string;
  categoria?: string;
  modalidade?: string;
  turma?: string;
  status?: string;
  statusFinanceiro?: string;
  status_financeiro?: string;
  financeiroStatus?: string;
  financeiro_status?: string;
  planoId?: string | number | null;
  plano_id?: string | number | null;
  plano?: string;
  planoNome?: string;
  plano_nome?: string;
};

export type PlanoOption = {
  id: string | number;
  nome: string;
  valor?: number | string;
  precoMensal?: number | string;
  preco_mensal?: number | string;
  mensalidade?: number | string;
};

export type CreatedChargeSummary = {
  id: string;
  txid: string;
  pixCopiaCola: string;
  status: string;
  payload: CriarCobrancaPayload;
};

export type ChargeStudentStatus = {
  alunoId?: string | number;
  aluno_id?: string | number;
  status?: string | null;
};

export type SubmitChargeResult =
  | {
      created?: unknown;
      pix?: unknown;
    }
  | unknown;
