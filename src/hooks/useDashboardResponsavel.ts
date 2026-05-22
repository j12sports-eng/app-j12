import { useEffect, useMemo, useState } from "react";

import { api, formatApiErrorMessage } from "@/lib/api";
import { useResponsavelStudents, type ResponsavelAluno } from "@/lib/responsavel-students-context";

export type DashboardResponsavel = {
  familia?: boolean;
  aluno?: {
    id?: string;
    nome: string;
    modalidade?: string;
    turma?: string;
    unidade?: string;
    professor?: string;
    categoria?: string;
    status?: string;
  };
  alunos?: ResponsavelAluno[];
  financeiro?: {
    mensalidade: number;
    status: string;
    totalAberto?: number;
    totalPago?: number;
    pendentes?: number;
  };
  presenca?: {
    percentual: number;
    presentes?: number;
    faltas?: number;
    total?: number;
  };
  plano?: {
    nome: string;
  };
  proximasAulas?: Array<{
    alunoId: string;
    alunoNome: string;
    turma: string;
    modalidade: string;
    unidade?: string;
    professor?: string;
    horario: string;
  }>;
  notificacoes?: Array<{
    id: string;
    titulo: string;
    mensagem: string;
    alunoNome?: string;
    lida?: boolean;
  }>;
};

function buildEndpoint(studentId: string | null) {
  if (!studentId) return "/responsavel/dashboard";
  return `/responsavel/dashboard?alunoId=${encodeURIComponent(studentId)}`;
}

export function useDashboardResponsavel() {
  const { alunos, loading: loadingAlunos, erro: erroAlunos, selectedStudentId } =
    useResponsavelStudents();
  const [dados, setDados] = useState<DashboardResponsavel | null>(null);
  const [loadingDados, setLoadingDados] = useState(false);
  const [erroDados, setErroDados] = useState("");

  const endpoint = useMemo(() => buildEndpoint(selectedStudentId), [selectedStudentId]);

  useEffect(() => {
    if (loadingAlunos) return;

    if (erroAlunos) {
      setDados(null);
      setErroDados(erroAlunos);
      setLoadingDados(false);
      return;
    }

    if (alunos.length === 0) {
      setDados(null);
      setErroDados("");
      setLoadingDados(false);
      return;
    }

    let active = true;

    async function carregar() {
      try {
        setLoadingDados(true);
        setErroDados("");

        const response = await api.get<DashboardResponsavel>(endpoint);
        if (active) setDados(response);
      } catch (error) {
        if (active) {
          setDados(null);
          setErroDados(formatApiErrorMessage(error, "Erro ao carregar dashboard"));
        }
      } finally {
        if (active) setLoadingDados(false);
      }
    }

    void carregar();

    return () => {
      active = false;
    };
  }, [alunos.length, endpoint, erroAlunos, loadingAlunos]);

  return {
    dados,
    loading: loadingAlunos || loadingDados,
    erro: erroAlunos || erroDados,
  };
}
