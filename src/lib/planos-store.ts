import { useSyncExternalStore } from "react";
import { api } from "./api";
import { createMysqlResourceStore } from "./mysql-resource-store";

export type StatusPlano = "ativo" | "rascunho" | "arquivado";
export type CategoriaPlano = "Kids" | "Base" | "Performance" | "Adulto" | "Personalizado";

export interface Plano extends Record<string, unknown> {
  id: string;
  nome: string;
  categoria: CategoriaPlano;
  descricao: string;
  precoMensal: number;
  taxaMatricula: number;
  fidelidadeMeses: number;
  aulasPorSemana: number;
  modalidades: string[];
  tags: string[];
  contratoVinculado: boolean;
  aceitaUpgrade: boolean;
  destaqueComercial: boolean;
  status: StatusPlano;
  atualizadoEm: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  valor: number;
  modalidade: string;
  unidade: string;
  dias_horarios: string;
  frequencia: string;
}

export interface PlanoInput {
  nome: string;
  categoria: CategoriaPlano;
  descricao: string;
  precoMensal: number;
  taxaMatricula: number;
  fidelidadeMeses: number;
  aulasPorSemana: number;
  modalidades: string[];
  tags: string[];
  contratoVinculado: boolean;
  aceitaUpgrade: boolean;
  destaqueComercial: boolean;
  status: StatusPlano;
  valor?: number;
  modalidade?: string;
  unidade?: string;
  dias_horarios?: string;
  frequencia?: string;
}

type Listener = () => void;

function nowIso() {
  return new Date().toISOString();
}

function text(value: unknown, max = 65535) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function integer(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function uniqueValues(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => {
          if (Array.isArray(value)) return value;
          if (typeof value === "string") {
            const normalized = value.trim();
            if (!normalized) return [];
            if (
              (normalized.startsWith("[") && normalized.endsWith("]")) ||
              (normalized.startsWith("{") && normalized.endsWith("}"))
            ) {
              try {
                const parsed = JSON.parse(normalized);
                return Array.isArray(parsed) ? parsed : [normalized];
              } catch {
                return normalized.split(/[;,|]/g);
              }
            }
            return normalized.split(/[;,|]/g);
          }
          return value == null ? [] : [String(value)];
        })
        .map((item) => String(item ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function normalizeStatus(value: unknown): StatusPlano {
  const normalized = text(value).toLowerCase();
  if (normalized === "ativo") return "ativo";
  if (normalized === "arquivado" || normalized === "inativo") return "arquivado";
  return "rascunho";
}

function normalizeCategoria(value: unknown): CategoriaPlano {
  switch (text(value)) {
    case "Kids":
    case "Performance":
    case "Adulto":
    case "Personalizado":
      return text(value) as CategoriaPlano;
    default:
      return "Base";
  }
}

function inferFrequencia(name: string, aulasPorSemana: number, explicitValue?: unknown) {
  const explicit = text(explicitValue);
  if (explicit) return explicit;

  const normalized = name.toLowerCase();
  if (normalized.includes("1x")) return "1x semana";
  if (normalized.includes("2x")) return "2x semana";
  if (normalized.includes("3x")) return "3x semana";
  if (normalized.includes("4x")) return "4x semana";
  if (normalized.includes("5x")) return "5x semana";
  if (normalized.includes("anual")) return "Anual";
  if (normalized.includes("semes")) return "Semestral";
  if (normalized.includes("trimes")) return "Trimestral";
  if (normalized.includes("bimes")) return "Bimestral";
  if (aulasPorSemana > 0) return `${aulasPorSemana}x semana`;
  return "Mensal";
}

function normalizePlano(raw: Partial<Plano> & Record<string, unknown>): Plano {
  const nome = text(raw.nome || raw.plano_nome || raw.name) || "Plano";
  const modalidades = uniqueValues([raw.modalidades, raw.modalidades_json, raw.modalidade]);
  const tags = uniqueValues([raw.tags, raw.tags_json]);
  const precoMensal = numeric(raw.precoMensal ?? raw.preco_mensal ?? raw.valor, 0);
  const aulasPorSemana = integer(raw.aulasPorSemana ?? raw.aulas_por_semana, 1) || 1;
  const status = normalizeStatus(raw.status);
  const categoria = normalizeCategoria(raw.categoria);
  const modalidadePrincipal = text(raw.modalidade) || modalidades[0] || "";

  return {
    id: text(raw.id) || `plano-${Date.now()}`,
    nome,
    categoria,
    descricao: text(raw.descricao, 65535) || "",
    precoMensal,
    taxaMatricula: numeric(raw.taxaMatricula ?? raw.taxa_matricula, 0),
    fidelidadeMeses: integer(raw.fidelidadeMeses ?? raw.fidelidade_meses, 1) || 1,
    aulasPorSemana,
    modalidades,
    tags,
    contratoVinculado:
      raw.contratoVinculado == null
        ? Boolean(raw.contrato_vinculado ?? true)
        : Boolean(raw.contratoVinculado),
    aceitaUpgrade:
      raw.aceitaUpgrade == null ? Boolean(raw.aceita_upgrade ?? true) : Boolean(raw.aceitaUpgrade),
    destaqueComercial:
      raw.destaqueComercial == null
        ? Boolean(raw.destaque_comercial ?? false)
        : Boolean(raw.destaqueComercial),
    status,
    atualizadoEm:
      text(raw.atualizadoEm ?? raw.updatedAt ?? raw.updated_at ?? raw.created_at) || nowIso(),
    createdAt: text(raw.createdAt ?? raw.created_at) || null,
    updatedAt: text(raw.updatedAt ?? raw.updated_at ?? raw.created_at) || null,
    valor: precoMensal,
    modalidade: modalidadePrincipal,
    unidade: text(raw.unidade) || "",
    dias_horarios: text(raw.dias_horarios ?? raw.diasHorarios) || "",
    frequencia: inferFrequencia(nome, aulasPorSemana, raw.frequencia),
  };
}

function serializePlano(plano: Plano | PlanoInput) {
  return {
    nome: text(plano.nome),
    categoria: normalizeCategoria(plano.categoria),
    descricao: text(plano.descricao),
    precoMensal: numeric(plano.precoMensal, 0),
    taxaMatricula: numeric(plano.taxaMatricula, 0),
    fidelidadeMeses: integer(plano.fidelidadeMeses, 1),
    aulasPorSemana: integer(plano.aulasPorSemana, 1),
    modalidades: uniqueValues(plano.modalidades as unknown[]),
    tags: uniqueValues(plano.tags as unknown[]),
    contratoVinculado: Boolean(plano.contratoVinculado),
    aceitaUpgrade: Boolean(plano.aceitaUpgrade),
    destaqueComercial: Boolean(plano.destaqueComercial),
    status: normalizeStatus(plano.status),
    valor: numeric(plano.precoMensal ?? plano.valor, 0),
    modalidade: text(plano.modalidade) || uniqueValues(plano.modalidades as unknown[])[0] || "",
    unidade: text(plano.unidade),
    dias_horarios: text(plano.dias_horarios),
    frequencia: text(plano.frequencia),
  };
}

const planosResource = createMysqlResourceStore<Plano>({
  endpoint: "/planos",
  initialState: [],
  normalize: normalizePlano,
  loadAll: () => api.get<Plano[]>("/planos"),
  createEntity: (entity) => api.post<Plano>("/planos", serializePlano(entity)),
  updateEntity: (entity) => api.put<Plano>(`/planos/${entity.id}`, serializePlano(entity)),
  deleteEntity: (id) => api.del(`/planos/${id}`),
});

let state: Plano[] = planosResource.getSnapshot();
const listeners = new Set<Listener>();

planosResource.subscribe(() => {
  state = planosResource.getSnapshot().map(normalizePlano);
  listeners.forEach((listener) => listener());
});

function replaceState(nextState: Plano[]) {
  planosResource.replaceState(nextState.map((item) => normalizePlano(item)));
}

function replaceById(targetId: string, nextPlano: Plano) {
  replaceState(
    planosResource
      .getSnapshot()
      .map((item) => (item.id === targetId ? normalizePlano(nextPlano) : item)),
  );
}

export function formatPlanoPrice(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function planoStatusLabel(status: StatusPlano) {
  switch (status) {
    case "ativo":
      return "Ativo";
    case "arquivado":
      return "Arquivado";
    default:
      return "Rascunho";
  }
}

export function planoStatusClass(status: StatusPlano) {
  switch (status) {
    case "ativo":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
    case "arquivado":
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
    default:
      return "border-amber-400/30 bg-amber-500/10 text-amber-300";
  }
}

export const planosStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return state;
  },
  getState() {
    return state;
  },
  load() {
    return planosResource.reload();
  },
  reload() {
    return planosResource.reload();
  },
  getById(id: string) {
    return state.find((plano) => plano.id === String(id)) ?? null;
  },
  create(data: PlanoInput) {
    const optimisticId = `tmp-plano-${Date.now()}`;
    const novo = normalizePlano({
      ...data,
      id: optimisticId,
      updated_at: nowIso(),
      created_at: nowIso(),
    });

    replaceState([novo, ...planosResource.getSnapshot()]);

    void api
      .post<Plano>("/planos", serializePlano(novo))
      .then((saved) => {
        replaceById(optimisticId, normalizePlano(saved as Record<string, unknown>));
      })
      .catch(async (error) => {
        console.error("[planos-store] Falha ao criar plano.", error);
        await planosResource.reload();
      });

    return novo;
  },
  update(id: string, data: Partial<PlanoInput>) {
    const current = state.find((plano) => plano.id === String(id));
    if (!current) return null;

    const next = normalizePlano({
      ...current,
      ...data,
      id: current.id,
      updated_at: nowIso(),
    });

    replaceState(
      planosResource.getSnapshot().map((plano) => (plano.id === next.id ? next : plano)),
    );

    void api
      .put<Plano>(`/planos/${id}`, serializePlano(next))
      .then((saved) => {
        replaceById(id, normalizePlano(saved as Record<string, unknown>));
      })
      .catch(async (error) => {
        console.error("[planos-store] Falha ao atualizar plano.", error);
        await planosResource.reload();
      });

    return next;
  },
  remove(id: string) {
    if (!state.some((plano) => plano.id === String(id))) return;

    replaceState(planosResource.getSnapshot().filter((plano) => plano.id !== String(id)));
    void api.del(`/planos/${id}`).catch(async (error) => {
      console.error("[planos-store] Falha ao remover plano.", error);
      await planosResource.reload();
    });
  },
  duplicate(id: string) {
    const current = state.find((plano) => plano.id === String(id));
    if (!current) return null;

    return planosStore.create({
      ...current,
      nome: `${current.nome} (copia)`,
      status: "rascunho",
      destaqueComercial: false,
    });
  },
  toggleStatus(id: string) {
    const current = state.find((plano) => plano.id === String(id));
    if (!current) return null;

    const nextStatus: StatusPlano =
      current.status === "arquivado" ? "ativo" : current.status === "ativo" ? "arquivado" : "ativo";

    return planosStore.update(id, { status: nextStatus });
  },
};

export function usePlanos() {
  return useSyncExternalStore(
    planosStore.subscribe,
    planosStore.getSnapshot,
    planosStore.getSnapshot,
  );
}

export function usePlanosStatus() {
  return useSyncExternalStore(
    planosStore.subscribe,
    planosResource.getMeta,
    planosResource.getMeta,
  );
}

export const getSnapshot = planosStore.getSnapshot;
export const subscribe = planosStore.subscribe;
