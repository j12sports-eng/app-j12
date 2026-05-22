import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export type PublicCatalogRecord = Record<string, any>;

function asPublicCatalogArray(value: unknown): PublicCatalogRecord[] {
  return Array.isArray(value) ? (value as PublicCatalogRecord[]) : [];
}

/**
 * Hook para carregar modalidades da API pública
 * Usado na página de matrícula do aluno
 */
export function usePublicModalidades() {
  return useQuery({
    queryKey: ["public-modalidades"],
    queryFn: async () => {
      console.log("[HOOK] Carregando modalidades públicas...");
      try {
        const response = await api.get<PublicCatalogRecord[]>("/public/modalidades", {
          skipAuthHeader: true,
          skipAuthRedirect: true,
        });
        const data = asPublicCatalogArray(response);
        console.log("[HOOK] Modalidades carregadas:", data.length, data);
        return data;
      } catch (error) {
        console.error("[HOOK] Erro ao carregar modalidades:", error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    gcTime: 1000 * 60 * 10, // 10 minutos (era cacheTime antes)
    retry: 2,
  });
}

/**
 * Hook para carregar unidades da API pública
 * Usado na página de matrícula do aluno
 */
export function usePublicUnidades() {
  return useQuery({
    queryKey: ["public-unidades"],
    queryFn: async () => {
      console.log("[HOOK] Carregando unidades públicas...");
      try {
        const response = await api.get<PublicCatalogRecord[]>("/public/unidades", {
          skipAuthHeader: true,
          skipAuthRedirect: true,
        });
        const data = asPublicCatalogArray(response);
        console.log("[HOOK] Unidades carregadas:", data.length, data);
        return data;
      } catch (error) {
        console.error("[HOOK] Erro ao carregar unidades:", error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    gcTime: 1000 * 60 * 10, // 10 minutos
    retry: 2,
  });
}

/**
 * Hook para carregar turmas/horários da API pública
 * Usado na página de matrícula do aluno
 */
export function usePublicTurmas() {
  return useQuery({
    queryKey: ["public-turmas"],
    queryFn: async () => {
      console.log("[HOOK] Carregando turmas públicas...");
      try {
        const response = await api.get<PublicCatalogRecord[]>("/public/turmas", {
          skipAuthHeader: true,
          skipAuthRedirect: true,
        });
        const data = asPublicCatalogArray(response);
        console.log("Categorias carregadas:", data);
        console.log("[HOOK] Turmas carregadas:", data.length, data);
        return data;
      } catch (error) {
        console.error("[HOOK] Erro ao carregar turmas:", error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    gcTime: 1000 * 60 * 10, // 10 minutos
    retry: 2,
  });
}

/**
 * Hook para carregar horários (alias para turmas)
 */
export function usePublicHorarios() {
  return usePublicTurmas();
}
