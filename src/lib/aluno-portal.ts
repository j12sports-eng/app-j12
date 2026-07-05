import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
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

export interface PortalAgendaAula {
  agendaItemId?: string | null;
  agendaSource?: string | null;
  classId?: string | null;
  className?: string | null;
  dayOfWeek?: string | null;
  endTime?: string | null;
  id: string;
  modality?: string | null;
  professorName?: string | null;
  scheduleDate?: string | null;
  scheduleStatus?: string | null;
  source?: string | null;
  startTime?: string | null;
  status?: string | null;
  turmaName?: string | null;
  type?: string | null;
  unitName?: string | null;
}

export interface PortalAgendaHistorico {
  attendanceStatus?: string | null;
  className?: string | null;
  date?: string | null;
  id: string;
  modality?: string | null;
  observations?: string | null;
  present?: boolean | null;
  scheduleDate?: string | null;
}

export interface PortalAgenda {
  agendaSource?: string | null;
  aulas: PortalAgendaAula[];
  eventos: PortalAgendaAula[];
  historico: PortalAgendaHistorico[];
  proximasAulas: PortalAgendaAula[];
  scheduleCount: number;
  summary?: {
    historicoCount?: number;
    proximasAulas?: number;
    totalAulas?: number;
  };
}

export interface PortalCarteirinha {
  aluno: {
    fotoUrl?: string | null;
    id: string;
    modalidade?: string | null;
    nome: string;
    turma?: string | null;
  };
  matricula: {
    desde?: string | null;
    numero?: string | null;
    plano?: string | null;
    status?: string | null;
  };
  qrCodeDataUrl?: string | null;
  qrPayload: string;
  responsavel?: {
    nome?: string | null;
    parentesco?: string | null;
    telefone?: string | null;
  } | null;
  statusMatricula?: string | null;
}

type PortalState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

function usePortalResource<T>(
  queryKey: readonly unknown[],
  load: () => Promise<T>,
  initialData: T,
  enabled = true,
): PortalState<T> {
  const query = useQuery({
    enabled: enabled && typeof window !== "undefined",
    queryFn: load,
    queryKey,
    retry: 1,
    staleTime: 30_000,
  });
  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    data: query.data ?? initialData,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refresh,
  };
}

export function usePortalAluno(enabled = true) {
  const loadAluno = useCallback(async () => mysqlApi.get<Aluno | null>("/aluno/me"), []);

  return usePortalResource<Aluno | null>(["portal-aluno", "aluno"], loadAluno, null, enabled);
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

  return usePortalResource<Transacao[]>(
    ["portal-aluno", "financeiro-legado"],
    loadFinanceiro,
    [],
    enabled,
  );
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

  return usePortalResource<PortalPresenca[]>(
    ["portal-aluno", "presencas-legado"],
    loadPresencas,
    [],
    enabled,
  );
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

  return usePortalResource<PortalContrato | null>(
    ["portal-aluno", "contrato"],
    loadContrato,
    null,
    enabled,
  );
}

export function usePortalNotificacoes(enabled = true) {
  const loadNotificacoes = useCallback(async () => {
    const notificacoes = await mysqlApi.get<PortalNotificacao[]>("/aluno/me/notificacoes");
    return Array.isArray(notificacoes) ? notificacoes : [];
  }, []);

  return usePortalResource<PortalNotificacao[]>(
    ["portal-aluno", "notificacoes-legado"],
    loadNotificacoes,
    [],
    enabled,
  );
}

export function usePortalAgenda(enabled = true) {
  const loadAgenda = useCallback(async () => {
    const agenda = await mysqlApi.get<Partial<PortalAgenda>>("/aluno/me/agenda");

    return {
      agendaSource: agenda.agendaSource ?? null,
      aulas: Array.isArray(agenda.aulas) ? agenda.aulas : [],
      eventos: Array.isArray(agenda.eventos) ? agenda.eventos : [],
      historico: Array.isArray(agenda.historico) ? agenda.historico : [],
      proximasAulas: Array.isArray(agenda.proximasAulas) ? agenda.proximasAulas : [],
      scheduleCount: Number(agenda.scheduleCount || agenda.aulas?.length || 0),
      summary: agenda.summary || {},
    };
  }, []);

  return usePortalResource<PortalAgenda>(
    ["portal-aluno", "agenda"],
    loadAgenda,
    {
      aulas: [],
      eventos: [],
      historico: [],
      proximasAulas: [],
      scheduleCount: 0,
      summary: {},
    },
    enabled,
  );
}

export function usePortalCarteirinha(enabled = true) {
  const loadCarteirinha = useCallback(
    async () => mysqlApi.get<PortalCarteirinha>("/aluno/me/carteirinha"),
    [],
  );

  return usePortalResource<PortalCarteirinha | null>(
    ["portal-aluno", "carteirinha"],
    loadCarteirinha,
    null,
    enabled,
  );
}
