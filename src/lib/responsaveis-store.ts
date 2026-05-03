import { useSyncExternalStore } from "react";
import { api } from "./api";
import { createMysqlResourceStore } from "./mysql-resource-store";

export interface Responsavel {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  endereco: string;
  rg: string;
  parentesco: string;
}

type ResponsavelInput = Omit<Responsavel, "id">;
type RawResponsavel = Partial<Responsavel> & Record<string, unknown>;

function text(value: unknown, max = 255) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function normalizeResponsavel(raw: RawResponsavel): Responsavel {
  return {
    id: text(raw.id, 64) || `responsavel-${Date.now()}`,
    nome: text(raw.nome, 191),
    cpf: text(raw.cpf, 20),
    telefone: text(raw.telefone ?? raw.whatsapp, 50),
    email: text(raw.email, 191),
    endereco: text(raw.endereco, 255),
    rg: text(raw.rg, 30),
    parentesco: text(raw.parentesco, 100),
  };
}

function serializeResponsavel(item: Responsavel | ResponsavelInput) {
  return {
    nome: text(item.nome, 191),
    cpf: text(item.cpf, 20),
    telefone: text(item.telefone, 50),
    email: text(item.email, 191),
    endereco: text(item.endereco, 255),
    rg: text(item.rg, 30),
    parentesco: text(item.parentesco, 100),
  };
}

const resource = createMysqlResourceStore<Responsavel>({
  endpoint: "/responsaveis",
  initialState: [],
  normalize: (item) => normalizeResponsavel(item as RawResponsavel),
  loadAll: () => api.get<Responsavel[]>("/responsaveis"),
  createEntity: (entity) => api.post<Responsavel>("/responsaveis", serializeResponsavel(entity)),
  updateEntity: (entity) =>
    api.put<Responsavel>(`/responsaveis/${entity.id}`, serializeResponsavel(entity)),
  deleteEntity: (id) => api.del(`/responsaveis/${id}`),
});

let state: Responsavel[] = resource.getSnapshot();
const listeners = new Set<() => void>();

resource.subscribe(() => {
  state = resource.getSnapshot().map((item) => normalizeResponsavel(item as RawResponsavel));
  listeners.forEach((listener) => listener());
});

function replaceState(nextState: Responsavel[]) {
  resource.replaceState(nextState.map((item) => normalizeResponsavel(item as RawResponsavel)));
}

function replaceById(targetId: string, nextItem: Responsavel) {
  replaceState(resource.getSnapshot().map((item) => (item.id === targetId ? nextItem : item)));
}

export const responsaveisStore = {
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
  create(data: ResponsavelInput) {
    const optimisticId = `tmp-responsavel-${Date.now()}`;
    const next = normalizeResponsavel({ ...data, id: optimisticId });
    replaceState([next, ...resource.getSnapshot()]);
    void api
      .post<Responsavel>("/responsaveis", serializeResponsavel(next))
      .then((saved) => replaceById(optimisticId, normalizeResponsavel(saved as RawResponsavel)))
      .catch(async (error) => {
        console.error("[responsaveis-store] Falha ao criar responsavel.", error);
        await resource.reload();
      });
    return next;
  },
  update(id: string, data: Partial<ResponsavelInput>) {
    const current = state.find((item) => item.id === String(id));
    if (!current) return null;
    const next = normalizeResponsavel({ ...current, ...data, id });
    replaceState(resource.getSnapshot().map((item) => (item.id === id ? next : item)));
    void api
      .put<Responsavel>(`/responsaveis/${id}`, serializeResponsavel(next))
      .then((saved) => replaceById(id, normalizeResponsavel(saved as RawResponsavel)))
      .catch(async (error) => {
        console.error("[responsaveis-store] Falha ao atualizar responsavel.", error);
        await resource.reload();
      });
    return next;
  },
  remove(id: string) {
    replaceState(resource.getSnapshot().filter((item) => item.id !== String(id)));
    void api.del(`/responsaveis/${id}`).catch(async (error) => {
      console.error("[responsaveis-store] Falha ao remover responsavel.", error);
      await resource.reload();
    });
  },
};

export function useResponsaveis() {
  return useSyncExternalStore(
    responsaveisStore.subscribe,
    responsaveisStore.getSnapshot,
    responsaveisStore.getSnapshot,
  );
}

export function useResponsaveisStatus() {
  return useSyncExternalStore(responsaveisStore.subscribe, resource.getMeta, resource.getMeta);
}
