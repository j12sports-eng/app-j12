import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Contrato = {
  id: number;
  titulo: string;
  status: string;
  arquivoPdf: string;
  dataEmissao: string;
  dataAssinatura?: string;
  observacoes?: string;
};

export function useContratoAluno() {
  const query = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => api.get<Contrato | null>("/aluno/me/contrato"),
    queryKey: ["portal-aluno", "contrato"],
    retry: 1,
    staleTime: 60_000,
  });

  return {
    contrato: query.data ?? null,
    loading: query.isLoading,
    erro: query.error instanceof Error ? query.error.message : "",
  };
}
