import { useSyncExternalStore } from "react";
import { createRemoteCollectionStore } from "./remote-collection";

export type StatusPlano = "ativo" | "rascunho" | "arquivado";
export type CategoriaPlano = "Kids" | "Base" | "Performance" | "Adulto" | "Personalizado";

export type Plano = {
  id: string;
  nome: string;
  categoria: CategoriaPlano;
  descricao: string;
  precoMensal: number;
  taxaMatricula: number;
  fidelidadeMeses: number;
  aulasPorSemana: number;
  modalidades: string[];
  contratoVinculado: boolean;
  aceitaUpgrade: boolean;
  destaqueComercial: boolean;
  status: StatusPlano;
  tags: string[];
  atualizadoEm: string;
};

export type PlanoInput = Omit<Plano, "id" | "atualizadoEm">;

const STORAGE_KEY = "j12.planos.v1";

function nowIso() {
  return new Date().toISOString();
}

function seedPlanos(): Plano[] {
  return [
    {
      id: "pln-essencial",
      nome: "Essencial Base",
      categoria: "Base",
      descricao:
        "Plano de entrada para alunos em formação, com foco em rotina técnica e progressão semanal.",
      precoMensal: 189.9,
      taxaMatricula: 79.9,
      fidelidadeMeses: 3,
      aulasPorSemana: 2,
      modalidades: ["Futebol"],
      contratoVinculado: true,
      aceitaUpgrade: true,
      destaqueComercial: false,
      status: "ativo",
      tags: ["Entrada", "Recorrência", "Contrato"],
      atualizadoEm: nowIso(),
    },
    {
      id: "pln-elite",
      nome: "Elite Performance",
      categoria: "Performance",
      descricao:
        "Plano premium com acompanhamento técnico ampliado, prioridade em avaliações e trilha de evolução.",
      precoMensal: 389.9,
      taxaMatricula: 0,
      fidelidadeMeses: 6,
      aulasPorSemana: 4,
      modalidades: ["Futebol", "Preparação física"],
      contratoVinculado: true,
      aceitaUpgrade: false,
      destaqueComercial: true,
      status: "ativo",
      tags: ["Premium", "Destaque", "Avaliação"],
      atualizadoEm: nowIso(),
    },
    {
      id: "pln-adulto-night",
      nome: "Adulto Night",
      categoria: "Adulto",
      descricao:
        "Estrutura pensada para treinos noturnos com proposta flexível de frequência e retenção.",
      precoMensal: 249.9,
      taxaMatricula: 59.9,
      fidelidadeMeses: 1,
      aulasPorSemana: 2,
      modalidades: ["Futebol society"],
      contratoVinculado: false,
      aceitaUpgrade: true,
      destaqueComercial: false,
      status: "rascunho",
      tags: ["Flexível", "Noturno"],
      atualizadoEm: nowIso(),
    },
    {
      id: "pln-kids-plus",
      nome: "Kids Plus",
      categoria: "Kids",
      descricao:
        "Oferta infantil com comunicação orientada aos responsáveis e benefícios de retenção semestral.",
      precoMensal: 219.9,
      taxaMatricula: 89.9,
      fidelidadeMeses: 6,
      aulasPorSemana: 2,
      modalidades: ["Iniciação esportiva"],
      contratoVinculado: true,
      aceitaUpgrade: true,
      destaqueComercial: true,
      status: "ativo",
      tags: ["Kids", "Responsável", "Semestral"],
      atualizadoEm: nowIso(),
    },
    {
      id: "pln-corporate",
      nome: "Corporate Squad",
      categoria: "Personalizado",
      descricao: "Modelo B2B para parcerias, grupos fechados e jornadas customizadas por unidade.",
      precoMensal: 0,
      taxaMatricula: 0,
      fidelidadeMeses: 12,
      aulasPorSemana: 0,
      modalidades: ["Customizável"],
      contratoVinculado: true,
      aceitaUpgrade: false,
      destaqueComercial: false,
      status: "arquivado",
      tags: ["B2B", "Sob consulta"],
      atualizadoEm: nowIso(),
    },
  ];
}

function normalizePlano(plano: Plano): Plano {
  return {
    ...plano,
    status:
      plano.status === "arquivado" || plano.status === "rascunho" || plano.status === "ativo"
        ? plano.status
        : "rascunho",
    categoria: plano.categoria || "Personalizado",
    modalidades: Array.isArray(plano.modalidades) ? plano.modalidades : [],
    tags: Array.isArray(plano.tags) ? plano.tags : [],
    atualizadoEm: plano.atualizadoEm || nowIso(),
  };
}

function load() {
  return seedPlanos();
}

const planosCollection = createRemoteCollectionStore<Plano[]>("planos", load());
let state: Plano[] = planosCollection.getSnapshot();
const listeners = new Set<() => void>();

planosCollection.subscribe(() => {
  state = planosCollection.getSnapshot();
  listeners.forEach((listener) => listener());
});

function emit() {
  planosCollection.replaceState(state);
}

function createPlanoId() {
  return `pln-${Date.now()}`;
}

export const planosStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return state;
  },
  getById(id: string) {
    return state.find((plano) => plano.id === id) ?? null;
  },
  create(data: PlanoInput) {
    const novo = normalizePlano({
      ...data,
      id: createPlanoId(),
      atualizadoEm: nowIso(),
    });
    state = [novo, ...state];
    emit();
    return novo;
  },
  update(id: string, data: PlanoInput) {
    state = state.map((plano) =>
      plano.id === id
        ? normalizePlano({
            ...plano,
            ...data,
            id,
            atualizadoEm: nowIso(),
          })
        : plano,
    );
    emit();
  },
  duplicate(id: string) {
    const original = state.find((plano) => plano.id === id);
    if (!original) return null;

    const duplicado = normalizePlano({
      ...original,
      id: createPlanoId(),
      nome: `${original.nome} Copia`,
      status: "rascunho",
      destaqueComercial: false,
      atualizadoEm: nowIso(),
    });

    state = [duplicado, ...state];
    emit();
    return duplicado;
  },
  remove(id: string) {
    state = state.filter((plano) => plano.id !== id);
    emit();
  },
  toggleStatus(id: string) {
    state = state.map((plano) => {
      if (plano.id !== id) return plano;

      const nextStatus =
        plano.status === "arquivado" ? "ativo" : plano.status === "ativo" ? "arquivado" : "ativo";

      return normalizePlano({
        ...plano,
        status: nextStatus,
        atualizadoEm: nowIso(),
      });
    });
    emit();
  },
  reset() {
    state = seedPlanos();
    emit();
  },
};

export function usePlanos() {
  return useSyncExternalStore(
    planosStore.subscribe,
    planosStore.getSnapshot,
    planosStore.getSnapshot,
  );
}

export function formatPlanoPrice(value: number) {
  if (value <= 0) return "Sob consulta";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
    case "arquivado":
      return "border-slate-500/30 bg-slate-500/15 text-slate-300";
    default:
      return "border-amber-400/30 bg-amber-500/15 text-amber-300";
  }
}
