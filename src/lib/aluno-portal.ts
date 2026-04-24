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

function usePortalResource<T>(path: string, initialData: T, enabled = true): PortalState<T> {
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
      const next = await mysqlApi.get<T>(path);
      setData(next);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [enabled, path]);

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
  return usePortalResource<Aluno | null>("/aluno/me", null, enabled);
}

export function usePortalFinanceiro(enabled = true) {
  return usePortalResource<Transacao[]>("/aluno/me/financeiro", [], enabled);
}

export function usePortalPresencas(enabled = true) {
  return usePortalResource<PortalPresenca[]>("/aluno/me/presencas", [], enabled);
}

export function usePortalContrato(enabled = true) {
  return usePortalResource<PortalContrato | null>("/aluno/me/contrato", null, enabled);
}

export function usePortalNotificacoes(enabled = true) {
  return usePortalResource<PortalNotificacao[]>("/aluno/me/notificacoes", [], enabled);
}
