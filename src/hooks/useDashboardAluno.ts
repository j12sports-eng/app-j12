import { useEffect, useState } from "react";

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
};

export function useDashboardAluno() {
  const [data, setData] = useState<DashboardAluno | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const result = await api.get<DashboardAluno>("/aluno/me/dashboard");

        setData(result);
      } catch (err: any) {
        console.error("ERRO DASHBOARD:", err);

        setError(err?.message || "Erro ao carregar dashboard");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return {
    data,
    loading,
    error,
  };
}
