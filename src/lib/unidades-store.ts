import { useSyncExternalStore } from "react";
import { apiFetch } from "./api";
import { createMysqlResourceStore } from "./mysql-resource-store";

export interface Unidade {
  id: string;
  nome: string;
  endereco: string;
  cidade: string;
  estado: string;
  telefone: string;
  ativa: boolean;
  status: "ativo" | "inativo";
}

type UnidadeInput = Omit<Unidade, "id">;
type RawUnidade = Partial<Unidade> & Record<string, unknown>;

function text(value: unknown, max = 255) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function normalizeAtiva(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;

  const normalized = text(value, 30).toLowerCase();

  if (["inativo", "inativa", "false", "0"].includes(normalized)) {
    return false;
  }

  if (["ativo", "ativa", "true", "1"].includes(normalized)) {
    return true;
  }

  return fallback;
}

function normalizeUnidade(raw: RawUnidade): Unidade {
  const ativa = normalizeAtiva(raw.ativa ?? raw.status, true);

  return {
    id: text(raw.id, 64) || `unidade-${Date.now()}`,
    nome: text(raw.nome, 191),
    endereco: text(raw.endereco, 255),
    cidade: text(raw.cidade, 191),
    estado: text(raw.estado, 50),
    telefone: text(raw.telefone, 50),
    ativa,
    status: ativa ? "ativo" : "inativo",
  };
}

function serializeUnidade(unidade: Unidade | UnidadeInput) {
  return {
    nome: text(unidade.nome, 191),
    endereco: text(unidade.endereco, 255),
    cidade: text(unidade.cidade, 191),
    estado: text(unidade.estado, 50),
    telefone: text(unidade.telefone, 50),
    ativa: Boolean(unidade.ativa),
    status: unidade.ativa ? "ativo" : "inativo",
  };
}

const resource = createMysqlResourceStore<Unidade>({
  endpoint: "/unidades",

  initialState: [],

  normalize: (item) => normalizeUnidade(item as RawUnidade),

  loadAll: () => apiFetch<Unidade[]>("/unidades"),

  createEntity: (entity) =>
    apiFetch<Unidade>("/unidades", {
      method: "POST",
      body: serializeUnidade(entity),
    }),

  updateEntity: (entity) =>
    apiFetch<Unidade>(`/unidades/${entity.id}`, {
      method: "PUT",
      body: serializeUnidade(entity),
    }),

  deleteEntity: (id) =>
    apiFetch(`/unidades/${id}`, {
      method: "DELETE",
    }),
});

let state: Unidade[] = resource.getSnapshot().map((item) => normalizeUnidade(item as RawUnidade));

const listeners = new Set<() => void>();

resource.subscribe(() => {
  state = resource.getSnapshot().map((item) => normalizeUnidade(item as RawUnidade));

  listeners.forEach((listener) => listener());
});

function replaceState(nextState: Unidade[]) {
  resource.replaceState(nextState.map((item) => normalizeUnidade(item as RawUnidade)));
}

function replaceById(targetId: string, nextItem: Unidade) {
  replaceState(resource.getSnapshot().map((item) => (item.id === targetId ? nextItem : item)));
}

export const unidadesStore = {
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

  create(data: UnidadeInput) {
    const optimisticId = `tmp-unidade-${Date.now()}`;

    const next = normalizeUnidade({
      ...data,
      id: optimisticId,
    });

    replaceState([next, ...resource.getSnapshot()]);

    void apiFetch<Unidade>("/unidades", {
      method: "POST",
      body: serializeUnidade(next),
    })
      .then((saved) => replaceById(optimisticId, normalizeUnidade(saved as RawUnidade)))
      .catch(async (error) => {
        console.error("[unidades-store] Falha ao criar unidade.", error);

        await resource.reload();
      });

    return next;
  },

  update(id: string, data: Partial<UnidadeInput>) {
    const current = state.find((item) => item.id === String(id));

    if (!current) {
      return null;
    }

    const next = normalizeUnidade({
      ...current,
      ...data,
      id,
    });

    replaceState(resource.getSnapshot().map((item) => (item.id === id ? next : item)));

    void apiFetch<Unidade>(`/unidades/${id}`, {
      method: "PUT",
      body: serializeUnidade(next),
    })
      .then((saved) => replaceById(id, normalizeUnidade(saved as RawUnidade)))
      .catch(async (error) => {
        console.error("[unidades-store] Falha ao atualizar unidade.", error);

        await resource.reload();
      });

    return next;
  },

  remove(id: string) {
    replaceState(resource.getSnapshot().filter((item) => item.id !== String(id)));

    void apiFetch(`/unidades/${id}`, {
      method: "DELETE",
    }).catch(async (error) => {
      console.error("[unidades-store] Falha ao remover unidade.", error);

      await resource.reload();
    });
  },
};

export function useUnidades() {
  return useSyncExternalStore(
    unidadesStore.subscribe,
    unidadesStore.getSnapshot,
    unidadesStore.getSnapshot,
  );
}

export function useUnidadesStatus() {
  return useSyncExternalStore(unidadesStore.subscribe, resource.getMeta, resource.getMeta);
}
