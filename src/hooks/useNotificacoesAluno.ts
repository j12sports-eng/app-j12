import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useNotificationCenter } from "@/features/notificacoes/hooks/useNotificationCenter";
import { api } from "@/lib/api";

type Notificacao = {
  created_at?: string;
  createdAt?: string;
  id: string;
  lida: boolean;
  mensagem: string;
  source?: "center" | "legacy";
  tipo: string;
  titulo: string;
};

function normalizeLegacyNotificacao(item: Partial<Notificacao>): Notificacao {
  return {
    created_at: item.created_at || item.createdAt || "",
    createdAt: item.createdAt || item.created_at || "",
    id: String(item.id),
    lida: Boolean(item.lida),
    mensagem: String(item.mensagem || ""),
    source: "legacy",
    tipo: String(item.tipo || "info"),
    titulo: String(item.titulo || "Notificacao"),
  };
}

export function useNotificacoesAluno() {
  const queryClient = useQueryClient();
  const center = useNotificationCenter({ limit: 80 });
  const legacyQuery = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: async () => {
      const response = await api.get<Notificacao[]>("/aluno/me/notificacoes");
      return (Array.isArray(response) ? response : []).map(normalizeLegacyNotificacao);
    },
    queryKey: ["portal-aluno", "notificacoes-legadas"],
    retry: 1,
    staleTime: 30_000,
  });

  const centerNotifications: Notificacao[] = center.notifications.map((item) => ({
    created_at: item.createdAt || "",
    createdAt: item.createdAt || "",
    id: item.id,
    lida: Boolean(item.lida),
    mensagem: item.message || "",
    source: "center",
    tipo: item.notificationType || "AGENDA",
    titulo: item.title || "Notificacao",
  }));
  const notificacoes = dedupeNotifications([
    ...centerNotifications,
    ...(legacyQuery.data || []),
  ]).sort((left, right) =>
    String(right.createdAt || "").localeCompare(String(left.createdAt || "")),
  );

  async function marcarComoLida(id: string) {
    const notification = notificacoes.find((item) => item.id === id);

    if (notification?.source === "center") {
      await center.markAsRead(id);
      return;
    }

    await api.put(`/aluno/me/notificacoes/${id}/lida`, {});
    await queryClient.invalidateQueries({ queryKey: ["portal-aluno", "notificacoes-legadas"] });
  }

  return {
    erro:
      (center.error instanceof Error ? center.error.message : "") ||
      (legacyQuery.error instanceof Error ? legacyQuery.error.message : ""),
    historico: center.history,
    loading: center.isLoading || legacyQuery.isLoading,
    marcarComoLida,
    marcarTodasComoLidas: center.markAllAsRead,
    notificacoes,
    preferencias: center.preferences,
    salvarPreferencias: center.updatePreferences,
  };
}

function dedupeNotifications(items: Notificacao[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
