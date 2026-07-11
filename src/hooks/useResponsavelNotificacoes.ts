import { useCallback, useEffect, useMemo, useState } from "react";

import { api, formatApiErrorMessage } from "@/lib/api";
import { useResponsavelStudents } from "@/lib/responsavel-students-context";
import { socket } from "@/lib/socket";

export type NotificacaoResponsavel = {
  id: string;
  alunoId: string;
  alunoNome: string;
  aluno_nome: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  created_at?: string;
  createdAt?: string;
};

function buildEndpoint(studentId: string | null) {
  if (!studentId) return "/responsavel/notificacoes";
  return `/responsavel/notificacoes?alunoId=${encodeURIComponent(studentId)}`;
}

function buildReadEndpoint(notificationId: string, studentId: string | null) {
  const base = `/responsavel/notificacoes/${encodeURIComponent(notificationId)}/lida`;
  if (!studentId) return base;
  return `${base}?alunoId=${encodeURIComponent(studentId)}`;
}

function normalizeNotificacao(item: Partial<NotificacaoResponsavel>): NotificacaoResponsavel {
  const alunoId = String(item.alunoId ?? "").trim();
  const alunoNome = String(item.alunoNome ?? item.aluno_nome ?? "Aluno").trim() || "Aluno";
  const createdAt = String(item.createdAt ?? item.created_at ?? "").trim();

  return {
    id: String(item.id ?? "").trim(),
    alunoId,
    alunoNome,
    aluno_nome: alunoNome,
    titulo: String(item.titulo ?? "Aviso J12").trim() || "Aviso J12",
    mensagem: String(item.mensagem ?? "").trim(),
    tipo: String(item.tipo ?? "info").trim(),
    lida: Boolean(item.lida),
    created_at: createdAt,
    createdAt,
  };
}

export function useResponsavelNotificacoes() {
  const {
    alunos,
    loading: loadingAlunos,
    erro: erroAlunos,
    selectedStudentId,
  } = useResponsavelStudents();
  const [notificacoes, setNotificacoes] = useState<NotificacaoResponsavel[]>([]);
  const [loadingDados, setLoadingDados] = useState(false);
  const [erroDados, setErroDados] = useState("");
  const endpoint = useMemo(() => buildEndpoint(selectedStudentId), [selectedStudentId]);

  const carregar = useCallback(
    async (isActive: () => boolean = () => true) => {
      if (loadingAlunos || erroAlunos || alunos.length === 0) return;

      try {
        if (isActive()) {
          setLoadingDados(true);
          setErroDados("");
        }

        const response = await api.get<NotificacaoResponsavel[]>(endpoint);
        if (isActive()) {
          setNotificacoes((Array.isArray(response) ? response : []).map(normalizeNotificacao));
        }
      } catch (error) {
        if (isActive()) {
          setNotificacoes([]);
          setErroDados(formatApiErrorMessage(error, "Erro ao carregar notificacoes"));
        }
      } finally {
        if (isActive()) setLoadingDados(false);
      }
    },
    [alunos.length, endpoint, erroAlunos, loadingAlunos],
  );

  async function marcarComoLida(id: string) {
    try {
      await api.put(buildReadEndpoint(id, selectedStudentId), {});
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
    } catch (error) {
      setErroDados(formatApiErrorMessage(error, "Erro ao marcar notificacao como lida"));
    }
  }

  useEffect(() => {
    if (loadingAlunos) return;

    if (erroAlunos) {
      setNotificacoes([]);
      setErroDados(erroAlunos);
      setLoadingDados(false);
      return;
    }

    if (alunos.length === 0) {
      setNotificacoes([]);
      setErroDados("");
      setLoadingDados(false);
      return;
    }

    // Impede que a resposta do dependente anterior substitua a selecao atual.
    let active = true;
    void carregar(() => active);

    return () => {
      active = false;
    };
  }, [alunos.length, carregar, erroAlunos, loadingAlunos]);

  useEffect(() => {
    function handleNovaNotificacao() {
      void carregar();
    }

    socket.on("nova_notificacao", handleNovaNotificacao);

    return () => {
      socket.off("nova_notificacao", handleNovaNotificacao);
    };
  }, [carregar]);

  return {
    notificacoes,
    loading: loadingAlunos || loadingDados,
    erro: erroAlunos || erroDados,
    marcarComoLida,
  };
}
