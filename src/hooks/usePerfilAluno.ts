import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

type PerfilAluno = {
  id: string;
  nome_completo: string;
  email_contato: string;
  fotoUrl?: string | null;
  numero_matricula?: string | null;
  plano_principal?: string | null;
  responsavel_detalhes?: {
    cpf?: string | null;
    email?: string | null;
    nome?: string | null;
    parentesco?: string | null;
    telefone?: string | null;
  } | null;
  telefone_contato?: string;
  turma_principal?: string | null;
  modalidade_principal?: string;
  status?: string;
};

export function usePerfilAluno() {
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => api.get<PerfilAluno>("/aluno/me/perfil"),
    queryKey: ["portal-aluno", "perfil"],
    retry: 1,
    staleTime: 60_000,
  });
  const mutation = useMutation({
    mutationFn: (payload: {
      email_contato?: string;
      foto_url?: string;
      telefone_contato?: string;
    }) => api.put("/aluno/me/perfil", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portal-aluno", "perfil"] }),
  });

  async function salvarPerfil(payload: {
    email_contato?: string;
    foto_url?: string;
    telefone_contato?: string;
  }) {
    try {
      await mutation.mutateAsync(payload);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  return {
    perfil: query.data ?? null,
    loading: query.isLoading,
    erro: query.error instanceof Error ? query.error.message : "",
    salvarPerfil,
    recarregar: () => query.refetch(),
  };
}
