import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

type PresencaApi = {
  id: string;
  turma?: string;
  modalidade?: string;
  dataAula?: string;
  presente?: boolean;
  observacao?: string;
};

type PresencaApiItem = PresencaApi & {
  data_aula?: string;
  turma_nome?: string;
  status?: string;
};

type PresencaView = {
  id: string;
  turma: string;
  modalidade: string;
  dataAula: string;
  data_aula: string;
  presente: boolean;
  status: "presente" | "falta";
  observacao: string;
};

type ResumoPresencas = {
  total_aulas: number;
  presentes: number;
  faltas: number;
  justificadas: number;
  percentual_presenca: number;
};

type PresencasPayload = {
  resumo: ResumoPresencas;
  presencas: PresencaView[];
};

type PresencasApiResponse =
  | PresencaApi[]
  | {
      resumo?: Partial<ResumoPresencas>;
      presencas?: PresencaApiItem[];
    };

function extractPresencas(payload: PresencasApiResponse): PresencaApiItem[] {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.presencas) ? payload.presencas : [];
}

function normalizePresencas(payload: PresencasApiResponse): PresencasPayload {
  const items = extractPresencas(payload);
  const presencas = items.map(
    (item): PresencaView => ({
      id: String(item.id),
      turma: item.turma || item.turma_nome || "Treino J12",
      modalidade: item.modalidade || "",
      dataAula: item.dataAula || item.data_aula || "",
      data_aula: item.dataAula || item.data_aula || "",
      presente: item.presente ?? item.status === "presente",
      status: item.presente || item.status === "presente" ? "presente" : "falta",
      observacao: item.observacao || "",
    }),
  );

  const totalAulas = presencas.length;
  const presentes = presencas.filter((item) => item.status === "presente").length;
  const faltas = presencas.filter((item) => item.status === "falta").length;
  const resumoApi = Array.isArray(payload) ? null : payload.resumo;

  return {
    resumo: {
      total_aulas: Number(resumoApi?.total_aulas ?? totalAulas),
      presentes: Number(resumoApi?.presentes ?? presentes),
      faltas: Number(resumoApi?.faltas ?? faltas),
      justificadas: Number(resumoApi?.justificadas ?? 0),
      percentual_presenca: Number(
        resumoApi?.percentual_presenca ??
          (totalAulas > 0 ? Number(((presentes / totalAulas) * 100).toFixed(2)) : 0),
      ),
    },
    presencas,
  };
}

export function usePresencasAluno() {
  const query = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: async () => normalizePresencas(await api.get<PresencasApiResponse>("/aluno/me/presencas")),
    queryKey: ["portal-aluno", "presencas"],
    retry: 1,
    staleTime: 30_000,
  });
  const dados = query.data ?? null;

  return {
    dados,
    resumo: dados?.resumo,
    presencas: dados?.presencas || [],
    loading: query.isLoading,
    erro: query.error instanceof Error ? query.error.message : "",
  };
}
