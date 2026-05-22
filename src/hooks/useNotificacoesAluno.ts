import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { socket } from "@/lib/socket";

type Notificacao = {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  created_at?: string;
  createdAt?: string;
};

function normalizeNotificacao(item: Notificacao): Notificacao {
  return {
    ...item,
    created_at: item.created_at || item.createdAt || "",
    createdAt: item.createdAt || item.created_at || "",
  };
}

export function useNotificacoesAluno() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);

  const [loading, setLoading] = useState(true);

  const [erro, setErro] = useState("");

  async function carregar() {
    try {
      setLoading(true);
      setErro("");

      const response = await api.get<Notificacao[]>("/aluno/me/notificacoes");

      setNotificacoes((Array.isArray(response) ? response : []).map(normalizeNotificacao));
    } catch (err: any) {
      console.error("ERRO NOTIFICACOES:", err);

      setErro(err?.message || "Erro ao carregar notificacoes");
    } finally {
      setLoading(false);
    }
  }

  async function marcarComoLida(id: string) {
    try {
      await api.put(`/aluno/me/notificacoes/${id}/lida`, {});

      setNotificacoes((old) =>
        old.map((item) =>
          item.id === id
            ? {
                ...item,
                lida: true,
              }
            : item,
        ),
      );
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    carregar();

    socket.on("nova_notificacao", () => {
      void carregar();
    });

    return () => {
      socket.off("nova_notificacao");
    };
  }, []);

  return {
    notificacoes,
    loading,
    erro,
    marcarComoLida,
  };
}
