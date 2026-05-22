import { useEffect, useMemo, useState } from "react";

import { api, formatApiErrorMessage } from "@/lib/api";
import { useResponsavelStudents } from "@/lib/responsavel-students-context";
import { ensureSocketConnected, socket } from "@/lib/socket";

export type MensalidadeResponsavel = {
  id: string;
  valor: number;
  valorFinal?: number;
  status: string;
  vencimento: string;
  competencia?: string;
  descricao?: string;
  alunoId: string;
  aluno_id: string;
  alunoNome: string;
  aluno_nome: string;
};

type FinanceiroResumo = {
  totalAberto: number;
  totalPago: number;
  pendentes: number;
};

function buildEndpoint(studentId: string | null) {
  if (!studentId) return "/responsavel/financeiro";
  return `/responsavel/financeiro?alunoId=${encodeURIComponent(studentId)}`;
}

function normalizeMensalidade(item: Partial<MensalidadeResponsavel>): MensalidadeResponsavel {
  const alunoId = String(item.alunoId ?? item.aluno_id ?? "").trim();
  const alunoNome = String(item.alunoNome ?? item.aluno_nome ?? "Aluno").trim() || "Aluno";
  const valor = Number(item.valorFinal ?? item.valor ?? 0);

  return {
    id: String(item.id ?? "").trim(),
    valor: Number.isFinite(valor) ? valor : 0,
    valorFinal: Number.isFinite(valor) ? valor : 0,
    status: String(item.status ?? "pendente").trim(),
    vencimento: String(item.vencimento ?? "").trim(),
    competencia: String(item.competencia ?? "").trim(),
    descricao: String(item.descricao ?? "").trim(),
    alunoId,
    aluno_id: alunoId,
    alunoNome,
    aluno_nome: alunoNome,
  };
}

function buildResumo(mensalidades: MensalidadeResponsavel[]): FinanceiroResumo {
  return mensalidades.reduce(
    (acc, item) => {
      const status = item.status.toLowerCase();

      if (status === "pago") {
        acc.totalPago += item.valor;
      } else if (status !== "cancelado" && status !== "cancelada") {
        acc.totalAberto += item.valor;
        acc.pendentes += 1;
      }

      return acc;
    },
    {
      totalAberto: 0,
      totalPago: 0,
      pendentes: 0,
    },
  );
}

export function useResponsavelFinanceiro() {
  const { alunos, loading: loadingAlunos, erro: erroAlunos, selectedStudentId } =
    useResponsavelStudents();
  const [mensalidades, setMensalidades] = useState<MensalidadeResponsavel[]>([]);
  const [loadingDados, setLoadingDados] = useState(false);
  const [erroDados, setErroDados] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const endpoint = useMemo(() => buildEndpoint(selectedStudentId), [selectedStudentId]);

  useEffect(() => {
    if (loadingAlunos) return;

    if (erroAlunos) {
      setMensalidades([]);
      setErroDados(erroAlunos);
      setLoadingDados(false);
      return;
    }

    if (alunos.length === 0) {
      setMensalidades([]);
      setErroDados("");
      setLoadingDados(false);
      return;
    }

    let active = true;

    async function carregar() {
      try {
        setLoadingDados(true);
        setErroDados("");

        const response = await api.get<MensalidadeResponsavel[]>(endpoint);
        const normalized = (Array.isArray(response) ? response : []).map(normalizeMensalidade);

        if (active) setMensalidades(normalized);
      } catch (error) {
        if (active) {
          setMensalidades([]);
          setErroDados(formatApiErrorMessage(error, "Erro ao carregar financeiro"));
        }
      } finally {
        if (active) setLoadingDados(false);
      }
    }

    void carregar();

    return () => {
      active = false;
    };
  }, [alunos.length, endpoint, erroAlunos, loadingAlunos, refreshToken]);

  useEffect(() => {
    ensureSocketConnected();
    const refresh = () => setRefreshToken((value) => value + 1);

    socket.on("financeiro:pagamento-atualizado", refresh);
    socket.on("dashboard:financeiro-atualizado", refresh);

    return () => {
      socket.off("financeiro:pagamento-atualizado", refresh);
      socket.off("dashboard:financeiro-atualizado", refresh);
    };
  }, []);

  return {
    mensalidades,
    resumo: buildResumo(mensalidades),
    loading: loadingAlunos || loadingDados,
    erro: erroAlunos || erroDados,
  };
}
