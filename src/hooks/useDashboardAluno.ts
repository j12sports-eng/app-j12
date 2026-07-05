import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type DashboardAluno = {
  nome: string;
  aluno?: {
    id: string;
    nome: string;
  };
  financeiro?: {
    mensalidade: number;
    status: string;
  };
  presenca?: {
    percentual: number;
    presentes?: number;
    faltas?: number;
  };
  plano?: {
    nome: string;
  };
  proximasAulas?: Array<{
    className?: string;
    dayOfWeek?: string;
    id: string;
    scheduleDate?: string | null;
    startTime?: string | null;
    turmaName?: string;
    unitName?: string;
  }>;
  proximosEventos?: Array<{
    className?: string;
    id: string;
    scheduleDate?: string | null;
    startTime?: string | null;
    title?: string;
  }>;
  avisos?: Array<{
    id: string;
    lida?: boolean;
    mensagem?: string;
    titulo?: string;
  }>;
  indicadores?: {
    avisosNaoLidos?: number;
    faltas?: number;
    frequencia?: number;
    presencas?: number;
    situacaoFinanceira?: string;
    statusMatricula?: string;
  };
};

export function useDashboardAluno() {
  const query = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => api.get<DashboardAluno>("/aluno/me/dashboard"),
    queryKey: ["portal-aluno", "dashboard"],
    retry: 1,
    staleTime: 30_000,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : "",
  };
}
