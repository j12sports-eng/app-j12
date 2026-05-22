import { useCallback, useEffect, useState } from "react";
import type { Aluno } from "./alunos-store";
import type { Transacao } from "./financeiro-store";
import { mysqlApi } from "./mysql-api";

export interface PortalPresenca {
  id: string;
  alunoId: string;
  turma: string;
  modalidade: string;
  dataAula: string;
  presente: boolean;
  observacao: string;
}

export interface PortalContrato {
  id: string;
  alunoId: string;
  tipoDocumento: string;
  titulo: string;
  status: string;
  arquivoPdf: string | null;
  templateHtml: string;
  dataEmissao: string | null;
  dataAssinatura: string | null;
  observacoes: string;
}

export interface PortalNotificacao {
  id: string;
  alunoId: string;
  titulo: string;
  mensagem: string;
  canal: string;
  tipo: string;
  lida: boolean;
  createdAt: string;
}

type PortalState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

function usePortalResource<T>(
  load: () => Promise<T>,
  initialData: T,
  enabled = true,
): PortalState<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const next = await load();
      setData(next);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [enabled, load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}

export function usePortalAluno(enabled = true) {
  const loadAluno = useCallback(async () => mysqlApi.get<Aluno | null>("/aluno/me"), []);

  return usePortalResource<Aluno | null>(loadAluno, null, enabled);
}

export function usePortalFinanceiro(enabled = true) {
  const loadFinanceiro = useCallback(async () => {
    const response = await mysqlApi.get<
      | Transacao[]
      | {
          mensalidades?: Array<
            Transacao & {
              plano_nome?: string;
              planoNome?: string;
              forma_pagamento?: string | null;
              data_pagamento?: string | null;
            }
          >;
        }
    >("/aluno/me/financeiro");
    const transacoes = Array.isArray(response) ? response : (response?.mensalidades ?? []);
    return Array.isArray(transacoes)
      ? transacoes.map((item) => ({
          ...item,
          planoNome: item.planoNome ?? item.plano_nome ?? item.planoNome,
          formaPagamento:
            item.formaPagamento ??
            (item as { forma_pagamento?: Transacao["formaPagamento"] }).forma_pagamento,
          dataPagamento:
            item.dataPagamento ??
            (item as { data_pagamento?: string | null }).data_pagamento ??
            item.pagoEm ??
            null,
          pagoEm:
            item.pagoEm ??
            (item as { data_pagamento?: string | null }).data_pagamento ??
            item.dataPagamento ??
            null,
        }))
      : [];
  }, []);

  return usePortalResource<Transacao[]>(loadFinanceiro, [], enabled);
}

export function usePortalPresencas(enabled = true) {
  const loadPresencas = useCallback(async () => {
    const response = await mysqlApi.get<
      | PortalPresenca[]
      | {
          presencas?: Array<
            PortalPresenca & {
              data_aula?: string;
              turma_nome?: string;
            }
          >;
        }
    >("/aluno/me/presencas");
    const presencas = Array.isArray(response) ? response : (response?.presencas ?? []);
    return Array.isArray(presencas)
      ? presencas.map((item) => ({
          ...item,
          dataAula: item.dataAula ?? (item as { data_aula?: string }).data_aula ?? "",
          turma: item.turma ?? (item as { turma_nome?: string }).turma_nome ?? "",
        }))
      : [];
  }, []);

  return usePortalResource<PortalPresenca[]>(loadPresencas, [], enabled);
}

export function usePortalContrato(enabled = true) {
  const loadContrato = useCallback(async () => {
    const contrato = await mysqlApi.get<
      | PortalContrato
      | {
          status?: string;
          message?: string;
          arquivoPdf?: string | null;
          dataEmissao?: string | null;
          dataAssinatura?: string | null;
          tipoDocumento?: string;
          templateHtml?: string;
          observacoes?: string;
        }
      | null
    >("/aluno/me/contrato");

    if (contrato && typeof contrato === "object" && "status" in contrato) {
      if (contrato.status === "nao_encontrado") {
        return null;
      }
    }

    return contrato as PortalContrato | null;
  }, []);

  return usePortalResource<PortalContrato | null>(loadContrato, null, enabled);
}

export function usePortalNotificacoes(enabled = true) {
  const loadNotificacoes = useCallback(async () => {
    const notificacoes = await mysqlApi.get<PortalNotificacao[]>("/aluno/me/notificacoes");
    return Array.isArray(notificacoes) ? notificacoes : [];
  }, []);

  return usePortalResource<PortalNotificacao[]>(loadNotificacoes, [], enabled);
}
