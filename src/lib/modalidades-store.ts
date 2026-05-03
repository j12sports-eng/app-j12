import { useSyncExternalStore } from "react";
import { api } from "./api";
import { createMysqlResourceStore } from "./mysql-resource-store";

export interface ModalidadeItemStore {
  id: string;
  nome: string;
  descricao: string;
  destaque: string;
  ativa: boolean;
  status: "ativo" | "inativo";
}

type ModalidadeInput = Omit<ModalidadeItemStore, "id">;
type RawModalidadeItemStore = Partial<ModalidadeItemStore> & Record<string, unknown>;

function text(value: unknown, max = 65535) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function normalizeAtiva(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  const normalized = text(value, 30).toLowerCase();
  if (["inativo", "inativa", "false", "0"].includes(normalized)) return false;
  if (["ativo", "ativa", "true", "1"].includes(normalized)) return true;
  return fallback;
}

function normalizeModalidade(raw: RawModalidadeItemStore): ModalidadeItemStore {
  const ativa = normalizeAtiva(raw.ativa ?? raw.status, true);
  return {
    id: text(raw.id, 64) || `modalidade-${Date.now()}`,
    nome: text(raw.nome, 191),
    descricao: text(raw.descricao, 65535),
    destaque: text(raw.destaque, 191),
    ativa,
    status: ativa ? "ativo" : "inativo",
  };
}

function serializeModalidade(item: ModalidadeItemStore | ModalidadeInput) {
  return {
    nome: text(item.nome, 191),
    descricao: text(item.descricao, 65535),
    destaque: text(item.destaque, 191),
    ativa: Boolean(item.ativa),
    status: item.ativa ? "ativo" : "inativo",
  };
}

const resource = createMysqlResourceStore<ModalidadeItemStore>({
  endpoint: "/modalidades",
  initialState: [],
  normalize: (item) => normalizeModalidade(item as RawModalidadeItemStore),
  loadAll: () => api.get<ModalidadeItemStore[]>("/modalidades"),
  createEntity: (entity) =>
    api.post<ModalidadeItemStore>("/modalidades", serializeModalidade(entity)),
  updateEntity: (entity) =>
    api.put<ModalidadeItemStore>(`/modalidades/${entity.id}`, serializeModalidade(entity)),
  deleteEntity: (id) => api.del(`/modalidades/${id}`),
});

let state: ModalidadeItemStore[] = resource.getSnapshot();
const listeners = new Set<() => void>();

resource.subscribe(() => {
  state = resource.getSnapshot().map((item) => normalizeModalidade(item as RawModalidadeItemStore));
  listeners.forEach((listener) => listener());
});

function replaceState(nextState: ModalidadeItemStore[]) {
  resource.replaceState(
    nextState.map((item) => normalizeModalidade(item as RawModalidadeItemStore)),
  );
}

function replaceById(targetId: string, nextItem: ModalidadeItemStore) {
  replaceState(resource.getSnapshot().map((item) => (item.id === targetId ? nextItem : item)));
}

export const modalidadesStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return state;
  },
  load() {
    return resource.reload();
  },
  reload() {
    return resource.reload();
  },
  getById(id: string) {
    return state.find((item) => item.id === String(id)) ?? null;
  },
  create(data: ModalidadeInput) {
    const optimisticId = `tmp-modalidade-${Date.now()}`;
    const next = normalizeModalidade({ ...data, id: optimisticId });
    replaceState([next, ...resource.getSnapshot()]);
    void api
      .post<ModalidadeItemStore>("/modalidades", serializeModalidade(next))
      .then((saved) =>
        replaceById(optimisticId, normalizeModalidade(saved as RawModalidadeItemStore)),
      )
      .catch(async (error) => {
        console.error("[modalidades-store] Falha ao criar modalidade.", error);
        await resource.reload();
      });
    return next;
  },
  update(id: string, data: Partial<ModalidadeInput>) {
    const current = state.find((item) => item.id === String(id));
    if (!current) return null;
    const next = normalizeModalidade({ ...current, ...data, id });
    replaceState(resource.getSnapshot().map((item) => (item.id === id ? next : item)));
    void api
      .put<ModalidadeItemStore>(`/modalidades/${id}`, serializeModalidade(next))
      .then((saved) => replaceById(id, normalizeModalidade(saved as RawModalidadeItemStore)))
      .catch(async (error) => {
        console.error("[modalidades-store] Falha ao atualizar modalidade.", error);
        await resource.reload();
      });
    return next;
  },
  remove(id: string) {
    replaceState(resource.getSnapshot().filter((item) => item.id !== String(id)));
    void api.del(`/modalidades/${id}`).catch(async (error) => {
      console.error("[modalidades-store] Falha ao remover modalidade.", error);
      await resource.reload();
    });
  },
};

export function useModalidades() {
  return useSyncExternalStore(
    modalidadesStore.subscribe,
    modalidadesStore.getSnapshot,
    modalidadesStore.getSnapshot,
  );
}

export function useModalidadesStatus() {
  return useSyncExternalStore(modalidadesStore.subscribe, resource.getMeta, resource.getMeta);
}
