import { useEffect, useMemo, useState } from "react";

import { api, formatApiErrorMessage } from "@/lib/api";
import { useResponsavelStudents } from "@/lib/responsavel-students-context";

export type ContratoResponsavel = {
  id: string;
  alunoId: string;
  alunoNome: string;
  aluno_nome: string;
  titulo: string;
  status: string;
  arquivoPdf?: string | null;
  dataEmissao?: string | null;
  dataAssinatura?: string | null;
  observacoes?: string;
};

function buildEndpoint(studentId: string | null) {
  if (!studentId) return "/responsavel/contratos";
  return `/responsavel/contratos?alunoId=${encodeURIComponent(studentId)}`;
}

function normalizeContrato(item: Partial<ContratoResponsavel>): ContratoResponsavel {
  const alunoId = String(item.alunoId ?? "").trim();
  const alunoNome = String(item.alunoNome ?? item.aluno_nome ?? "Aluno").trim() || "Aluno";

  return {
    id: String(item.id ?? "").trim(),
    alunoId,
    alunoNome,
    aluno_nome: alunoNome,
    titulo: String(item.titulo ?? "Contrato J12").trim() || "Contrato J12",
    status: String(item.status ?? "pendente").trim(),
    arquivoPdf: item.arquivoPdf ?? null,
    dataEmissao: item.dataEmissao ?? null,
    dataAssinatura: item.dataAssinatura ?? null,
    observacoes: String(item.observacoes ?? "").trim(),
  };
}

export function useResponsavelContratos() {
  const { alunos, loading: loadingAlunos, erro: erroAlunos, selectedStudentId } =
    useResponsavelStudents();
  const [contratos, setContratos] = useState<ContratoResponsavel[]>([]);
  const [loadingDados, setLoadingDados] = useState(false);
  const [erroDados, setErroDados] = useState("");
  const endpoint = useMemo(() => buildEndpoint(selectedStudentId), [selectedStudentId]);

  useEffect(() => {
    if (loadingAlunos) return;

    if (erroAlunos) {
      setContratos([]);
      setErroDados(erroAlunos);
      setLoadingDados(false);
      return;
    }

    if (alunos.length === 0) {
      setContratos([]);
      setErroDados("");
      setLoadingDados(false);
      return;
    }

    let active = true;

    async function carregar() {
      try {
        setLoadingDados(true);
        setErroDados("");

        const response = await api.get<ContratoResponsavel[]>(endpoint);
        const normalized = (Array.isArray(response) ? response : []).map(normalizeContrato);

        if (active) setContratos(normalized);
      } catch (error) {
        if (active) {
          setContratos([]);
          setErroDados(formatApiErrorMessage(error, "Erro ao carregar contratos"));
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
    contratos,
    loading: loadingAlunos || loadingDados,
    erro: erroAlunos || erroDados,
  };
}

