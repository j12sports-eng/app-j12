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

type Mensalidade = {
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
  mensalidades: Mensalidade[];
};

function normalizeFinanceiro(items: CobrancaApi[]): FinanceiroResponse {
  const today = new Date().toISOString().slice(0, 10);

  const mensalidades = items.map((item): Mensalidade => {
    const valor = Number(item.valorFinal ?? item.valor ?? 0);

    const dias_em_atraso =
      item.status === "vencido" && item.vencimento && item.vencimento < today
        ? Math.max(Math.floor((Date.now() - new Date(item.vencimento).getTime()) / 86400000), 0)
        : 0;

    return {
      id: String(item.id),
      valor,
      vencimento: item.vencimento,
      status: item.status,
      competencia: item.competencia || "",
      dias_em_atraso,
    };
  });

  const resumo = mensalidades.reduce(
    (acc, item) => {
      if (item.status === "pago") {
        acc.total_pago += item.valor;
      } else if (item.status !== "cancelada") {
        acc.total_aberto += item.valor;
        acc.pendentes += 1;
      }

      return acc;
    },
    {
      total_aberto: 0,
      total_pago: 0,
      pendentes: 0,
    },
  );

  return {
    resumo: {
      total_aberto: Number(resumo.total_aberto.toFixed(2)),
      total_pago: Number(resumo.total_pago.toFixed(2)),
      pendentes: resumo.pendentes,
    },
    mensalidades,
  };
}

export function useFinanceiro() {
  const [financeiro, setFinanceiro] = useState<FinanceiroResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [erro, setErro] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    async function carregar() {
      try {
        setLoading(true);
        setErro("");

        const result = await api.get<CobrancaApi[]>("/aluno/me/financeiro");

        setFinanceiro(normalizeFinanceiro(Array.isArray(result) ? result : []));
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
    financeiro,
    mensalidades: financeiro?.mensalidades || [],
    resumo: financeiro?.resumo,
    loading,
    erro,
  };
}
