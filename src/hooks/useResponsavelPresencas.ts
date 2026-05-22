import { useEffect, useMemo, useState } from "react";

import { api, formatApiErrorMessage } from "@/lib/api";
import { useResponsavelStudents } from "@/lib/responsavel-students-context";

type PresencaApi = {
  id: string;
  alunoId?: string;
  aluno_id?: string;
  alunoNome?: string;
  aluno_nome?: string;
  turma?: string;
  modalidade?: string;
  dataAula?: string;
  data_aula?: string;
  presente?: boolean;
  status?: "presente" | "falta" | "justificada";
  observacao?: string;
};

export type PresencaResponsavel = {
  id: string;
  alunoId: string;
  alunoNome: string;
  aluno_nome: string;
  turma: string;
  modalidade: string;
  dataAula: string;
  data_aula: string;
  presente: boolean;
  status: "presente" | "falta" | "justificada";
  observacao: string;
};

type ResumoPresencas = {
  total_aulas: number;
  presentes: number;
  faltas: number;
  justificadas: number;
  percentual_presenca: number;
};

function buildEndpoint(studentId: string | null) {
  if (!studentId) return "/responsavel/presencas";
  return `/responsavel/presencas?alunoId=${encodeURIComponent(studentId)}`;
}

function normalizePresenca(item: PresencaApi): PresencaResponsavel {
  const status =
    item.status === "justificada" || item.status === "presente" || item.status === "falta"
      ? item.status
      : item.presente
        ? "presente"
        : "falta";

  return {
    id: String(item.id ?? "").trim(),
    alunoId: String(item.alunoId ?? item.aluno_id ?? "").trim(),
    alunoNome: String(item.alunoNome ?? item.aluno_nome ?? "Aluno").trim() || "Aluno",
    aluno_nome: String(item.alunoNome ?? item.aluno_nome ?? "Aluno").trim() || "Aluno",
    turma: String(item.turma ?? "Treino J12").trim() || "Treino J12",
    modalidade: String(item.modalidade ?? "").trim(),
    dataAula: String(item.dataAula ?? item.data_aula ?? "").trim(),
    data_aula: String(item.data_aula ?? item.dataAula ?? "").trim(),
    presente: status === "presente",
    status,
    observacao: String(item.observacao ?? "").trim(),
  };
}

function buildResumo(presencas: PresencaResponsavel[]): ResumoPresencas {
  const totalAulas = presencas.length;
  const presentes = presencas.filter((item) => item.status === "presente").length;
  const justificadas = presencas.filter((item) => item.status === "justificada").length;
  const faltas = presencas.filter((item) => item.status === "falta").length;

  return {
    total_aulas: totalAulas,
    presentes,
    faltas,
    justificadas,
    percentual_presenca:
      totalAulas > 0 ? Number(((presentes / totalAulas) * 100).toFixed(2)) : 0,
  };
}

export function useResponsavelPresencas() {
  const { alunos, loading: loadingAlunos, erro: erroAlunos, selectedStudentId } =
    useResponsavelStudents();
  const [presencas, setPresencas] = useState<PresencaResponsavel[]>([]);
  const [loadingDados, setLoadingDados] = useState(false);
  const [erroDados, setErroDados] = useState("");
  const endpoint = useMemo(() => buildEndpoint(selectedStudentId), [selectedStudentId]);

  useEffect(() => {
    if (loadingAlunos) return;

    if (erroAlunos) {
      setPresencas([]);
      setErroDados(erroAlunos);
      setLoadingDados(false);
      return;
    }

    if (alunos.length === 0) {
      setPresencas([]);
      setErroDados("");
      setLoadingDados(false);
      return;
    }

    let active = true;

    async function carregar() {
      try {
        setLoadingDados(true);
        setErroDados("");

        const response = await api.get<PresencaApi[]>(endpoint);
        const normalized = (Array.isArray(response) ? response : []).map(normalizePresenca);

        if (active) setPresencas(normalized);
      } catch (error) {
        if (active) {
          setPresencas([]);
          setErroDados(formatApiErrorMessage(error, "Erro ao carregar presencas"));
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
    presencas,
    resumo: buildResumo(presencas),
    loading: loadingAlunos || loadingDados,
    erro: erroAlunos || erroDados,
  };
}

