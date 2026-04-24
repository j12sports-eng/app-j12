import { useSyncExternalStore } from "react";
import { alunosStore, type Modalidade } from "./alunos-store";
import { createRemoteCollectionStore } from "./remote-collection";

export type DiaSemana = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";

export const DIAS_SEMANA: { value: DiaSemana; label: string; short: string }[] = [
  { value: "seg", label: "Segunda", short: "Seg" },
  { value: "ter", label: "Terça", short: "Ter" },
  { value: "qua", label: "Quarta", short: "Qua" },
  { value: "qui", label: "Quinta", short: "Qui" },
  { value: "sex", label: "Sexta", short: "Sex" },
  { value: "sab", label: "Sábado", short: "Sáb" },
  { value: "dom", label: "Domingo", short: "Dom" },
];

export interface PresencaRegistro {
  alunoId: string;
  presente: boolean;
}

export interface SessaoPresenca {
  id: string;
  data: string; // YYYY-MM-DD
  registros: PresencaRegistro[];
}

export interface Turma {
  id: string;
  nome: string;
  modalidade: Modalidade;
  unidade: string;
  professorId?: string | null;
  professor: string;
  diasSemana: DiaSemana[];
  horarioInicio: string; // HH:MM
  horarioFim: string;
  capacidadeMaxima: number;
  ativa: boolean;
  alunoIds: string[];
  presencas: SessaoPresenca[];
  criadaEm: string;
}

const STORAGE_KEY = "j12.turmas.v1";

const seed: Turma[] = [
  {
    id: "tu1",
    nome: "Sub-11 Tarde",
    modalidade: "Futebol",
    unidade: "Unidade Centro",
    professorId: "pr1",
    professor: "Prof. Ricardo Mendes",
    diasSemana: ["seg", "qua", "sex"],
    horarioInicio: "14:00",
    horarioFim: "15:30",
    capacidadeMaxima: 20,
    ativa: true,
    alunoIds: ["a1", "a8"],
    presencas: [],
    criadaEm: "2024-02-01",
  },
  {
    id: "tu2",
    nome: "Sub-13 Tarde",
    modalidade: "Vôlei",
    unidade: "Unidade Centro",
    professorId: "pr2",
    professor: "Profa. Camila Rocha",
    diasSemana: ["ter", "qui"],
    horarioInicio: "15:00",
    horarioFim: "16:30",
    capacidadeMaxima: 18,
    ativa: true,
    alunoIds: ["a2", "a6"],
    presencas: [],
    criadaEm: "2024-02-01",
  },
  {
    id: "tu3",
    nome: "Sub-15 Noite",
    modalidade: "Futsal",
    unidade: "Unidade Zona Sul",
    professorId: "pr4",
    professor: "Prof. André Silva",
    diasSemana: ["seg", "qua"],
    horarioInicio: "19:00",
    horarioFim: "20:30",
    capacidadeMaxima: 16,
    ativa: true,
    alunoIds: ["a3"],
    presencas: [],
    criadaEm: "2024-02-01",
  },
  {
    id: "tu4",
    nome: "Adulto Noite",
    modalidade: "Basquete",
    unidade: "Unidade Centro",
    professorId: "pr3",
    professor: "Prof. Bruno Lima",
    diasSemana: ["ter", "qui"],
    horarioInicio: "20:00",
    horarioFim: "21:30",
    capacidadeMaxima: 24,
    ativa: true,
    alunoIds: ["a4"],
    presencas: [],
    criadaEm: "2024-02-01",
  },
  {
    id: "tu5",
    nome: "Sub-9 Manhã",
    modalidade: "Futebol",
    unidade: "Unidade Zona Norte",
    professorId: "pr1",
    professor: "Prof. Ricardo Mendes",
    diasSemana: ["sab"],
    horarioInicio: "09:00",
    horarioFim: "10:30",
    capacidadeMaxima: 15,
    ativa: true,
    alunoIds: ["a5"],
    presencas: [],
    criadaEm: "2024-02-01",
  },
];

function load(): Turma[] {
  return [...seed];
}

const turmasCollection = createRemoteCollectionStore<Turma[]>("turmas", load());
let state: Turma[] = turmasCollection.getSnapshot();
const listeners = new Set<() => void>();

turmasCollection.subscribe(() => {
  state = turmasCollection.getSnapshot();
  listeners.forEach((listener) => listener());
});

function emit() {
  turmasCollection.replaceState(state);
}

export const turmasStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): Turma[] {
    return state;
  },
  getById(id: string): Turma | undefined {
    return state.find((t) => t.id === id);
  },
  create(data: Omit<Turma, "id" | "alunoIds" | "presencas" | "criadaEm">) {
    const nova: Turma = {
      ...data,
      id: `tu${Date.now()}`,
      alunoIds: [],
      presencas: [],
      criadaEm: new Date().toISOString().slice(0, 10),
    };
    state = [nova, ...state];
    emit();
    return nova;
  },
  update(id: string, data: Partial<Omit<Turma, "id" | "alunoIds" | "presencas">>) {
    state = state.map((t) => (t.id === id ? { ...t, ...data } : t));
    emit();
  },
  toggleAtiva(id: string) {
    state = state.map((t) => (t.id === id ? { ...t, ativa: !t.ativa } : t));
    emit();
  },
  remove(id: string) {
    state = state.filter((t) => t.id !== id);
    emit();
  },
  adicionarAluno(turmaId: string, alunoId: string): { ok: boolean; reason?: string } {
    const t = state.find((x) => x.id === turmaId);
    if (!t) return { ok: false, reason: "Turma não encontrada" };
    if (t.alunoIds.includes(alunoId)) return { ok: false, reason: "Aluno já está nesta turma" };
    if (t.alunoIds.length >= t.capacidadeMaxima)
      return { ok: false, reason: "Capacidade máxima atingida" };
    state = state.map((x) => (x.id === turmaId ? { ...x, alunoIds: [...x.alunoIds, alunoId] } : x));
    emit();
    return { ok: true };
  },
  removerAluno(turmaId: string, alunoId: string) {
    state = state.map((x) =>
      x.id === turmaId ? { ...x, alunoIds: x.alunoIds.filter((id) => id !== alunoId) } : x,
    );
    emit();
  },
  registrarPresenca(turmaId: string, data: string, registros: PresencaRegistro[]) {
    state = state.map((t) => {
      if (t.id !== turmaId) return t;
      const outras = t.presencas.filter((p) => p.data !== data);
      const sessao: SessaoPresenca = {
        id: `s${Date.now()}`,
        data,
        registros,
      };
      return { ...t, presencas: [...outras, sessao].sort((a, b) => b.data.localeCompare(a.data)) };
    });
    emit();
  },
  removerSessao(turmaId: string, sessaoId: string) {
    state = state.map((t) =>
      t.id === turmaId ? { ...t, presencas: t.presencas.filter((p) => p.id !== sessaoId) } : t,
    );
    emit();
  },
};

export function useTurmas(): Turma[] {
  return useSyncExternalStore(
    turmasStore.subscribe,
    turmasStore.getSnapshot,
    turmasStore.getSnapshot,
  );
}

/** Retorna turmas em que o aluno está matriculado. */
export function turmasDoAluno(alunoId: string): Turma[] {
  return state.filter((t) => t.alunoIds.includes(alunoId));
}

/** Estatísticas de presença de um aluno em uma turma. */
export function statsPresencaAluno(turma: Turma, alunoId: string) {
  let total = 0;
  let presentes = 0;
  for (const sessao of turma.presencas) {
    const reg = sessao.registros.find((r) => r.alunoId === alunoId);
    if (!reg) continue;
    total += 1;
    if (reg.presente) presentes += 1;
  }
  const taxa = total > 0 ? Math.round((presentes / total) * 100) : 0;
  return { total, presentes, faltas: total - presentes, taxa };
}

export function formatDias(dias: DiaSemana[]): string {
  const map: Record<DiaSemana, string> = {
    seg: "Seg",
    ter: "Ter",
    qua: "Qua",
    qui: "Qui",
    sex: "Sex",
    sab: "Sáb",
    dom: "Dom",
  };
  return dias.map((d) => map[d]).join(" · ");
}

// Mantém referência usada para auto-limpeza quando aluno é removido
alunosStore.subscribe(() => {
  const validos = new Set(alunosStore.getSnapshot().map((a) => a.id));
  let mudou = false;
  const novo = state.map((t) => {
    const filtered = t.alunoIds.filter((id) => validos.has(id));
    if (filtered.length !== t.alunoIds.length) {
      mudou = true;
      return { ...t, alunoIds: filtered };
    }
    return t;
  });
  if (mudou) {
    state = novo;
    emit();
  }
});
