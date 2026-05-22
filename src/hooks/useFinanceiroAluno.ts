import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { ensureSocketConnected, socket } from "@/lib/socket";

type CobrancaApi = {
  id: string;
  valor?: number;
  valorFinal?: number;
  vencimento: string;
  status: string;
  competencia?: string;
};

type MensalidadeView = {
  id: string;
  valor: number;
  vencimento: string;
  status: string;
  competencia: string;
  dias_em_atraso: number;
};

type FinanceiroResponse = {
  resumo: {
    total_aberto: number;
    total_pago: number;
    pendentes: number;
  };
  mensalidades: MensalidadeView[];
};

type FinanceiroApiResponse =
  | CobrancaApi[]
  | {
      resumo?: Partial<FinanceiroResponse["resumo"]> & {
        total_pendente?: number;
        total_vencido?: number;
      };
      mensalidades?: CobrancaApi[];
    };

function extractMensalidades(payload: FinanceiroApiResponse): CobrancaApi[] {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.mensalidades) ? payload.mensalidades : [];
}

function normalizeFinanceiro(payload: FinanceiroApiResponse): FinanceiroResponse {
  const items = extractMensalidades(payload);
  const today = new Date().toISOString().slice(0, 10);

  const mensalidades = items.map((item): MensalidadeView => {
    const valor = Number(item.valorFinal ?? item.valor ?? 0);

    const diasEmAtraso =
      item.status === "vencido" && item.vencimento && item.vencimento < today
        ? Math.max(Math.floor((Date.now() - new Date(item.vencimento).getTime()) / 86400000), 0)
        : 0;

    return {
      id: String(item.id),
      valor,
      vencimento: item.vencimento,
      status: item.status,
      competencia: item.competencia || "",
      dias_em_atraso: diasEmAtraso,
    };
  });

  const totalCalculadoAberto = mensalidades
    .filter((item) => item.status !== "pago" && item.status !== "cancelada")
    .reduce((acc, item) => acc + item.valor, 0);

  const totalPago = mensalidades
    .filter((item) => item.status === "pago")
    .reduce((acc, item) => acc + item.valor, 0);

  const pendentes = mensalidades.filter(
    (item) => item.status !== "pago" && item.status !== "cancelada",
  ).length;
  const resumoApi = Array.isArray(payload) ? null : payload.resumo;
  const totalAbertoApi =
    resumoApi?.total_aberto ??
    Number(resumoApi?.total_pendente || 0) + Number(resumoApi?.total_vencido || 0);
  const totalAberto = Number(totalAbertoApi || totalCalculadoAberto);

  return {
    resumo: {
      total_aberto: Number(totalAberto.toFixed(2)),
      total_pago: Number(Number(resumoApi?.total_pago ?? totalPago).toFixed(2)),
      pendentes: Number(resumoApi?.pendentes ?? pendentes),
    },
    mensalidades,
  };
}

export function useFinanceiroAluno() {
  const [dados, setDados] = useState<FinanceiroResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [erro, setErro] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    async function carregar() {
      try {
        setLoading(true);
        setErro("");

        const response = await api.get<FinanceiroApiResponse>("/aluno/me/financeiro");

        setDados(normalizeFinanceiro(response));
      } catch (err: any) {
        console.error("ERRO FINANCEIRO:", err);

        setErro(err?.message || "Erro ao carregar financeiro");
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [refreshToken]);

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
    dados,
    loading,
    erro,
  };
}
