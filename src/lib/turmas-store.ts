import { useSyncExternalStore } from "react";
import { type Modalidade } from "./alunos-store";
import { api } from "./api";
import { createMysqlResourceStore } from "./mysql-resource-store";

export type DiaSemana = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";

export const DIAS_SEMANA: { value: DiaSemana; label: string; short: string }[] = [
  { value: "seg", label: "Segunda", short: "Seg" },
  { value: "ter", label: "Terca", short: "Ter" },
  { value: "qua", label: "Quarta", short: "Qua" },
  { value: "qui", label: "Quinta", short: "Qui" },
  { value: "sex", label: "Sexta", short: "Sex" },
  { value: "sab", label: "Sabado", short: "Sab" },
  { value: "dom", label: "Domingo", short: "Dom" },
];

export interface PresencaRegistro {
  alunoId: string;
  presente: boolean;
}

export interface SessaoPresenca {
  id: string;
  data: string;
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
  horarioInicio: string;
  horarioFim: string;
  capacidadeMaxima: number;
  ativa: boolean;
  alunoIds: string[];
  presencas: SessaoPresenca[];
  criadaEm: string | null;
}

type TurmaInput = Omit<Turma, "id" | "alunoIds" | "presencas" | "criadaEm">;
type RawTurma = Partial<Turma> & Record<string, unknown>;

function text(value: unknown, max = 191) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function integer(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return (value ?? fallback) as T;

  try {
    const parsed = JSON.parse(String(value)) as T;
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function uniqueValues(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function parseDiasSemana(value: unknown): DiaSemana[] {
  const direct = Array.isArray(value) ? value : safeJsonParse<string[]>(value, []);
  if (Array.isArray(direct) && direct.length > 0) {
    return uniqueValues(direct) as DiaSemana[];
  }

  const raw = text(value, 191).toLowerCase();
  if (!raw) return [];
  return uniqueValues(raw.split(/[/,;|]/g)) as DiaSemana[];
}

function normalizeTurma(raw: RawTurma): Turma {
  return {
    id: text(raw.id, 64) || `turma-${Date.now()}`,
    nome: text(raw.nome, 191),
    modalidade: (text(raw.modalidade, 191) || "Futebol") as Modalidade,
    unidade: text(raw.unidade, 191),
    professorId: text(raw.professorId ?? raw.professor_id, 64) || null,
    professor: text(raw.professor, 191),
    diasSemana: parseDiasSemana(raw.diasSemana ?? raw.dias_semana ?? raw.dias_semana_json),
    horarioInicio: text(raw.horarioInicio ?? raw.horario_inicio ?? raw.horario, 20) || "19:00",
    horarioFim: text(raw.horarioFim ?? raw.horario_fim, 20) || "20:30",
    capacidadeMaxima: integer(raw.capacidadeMaxima ?? raw.capacidade, 0),
    ativa: Boolean(raw.ativa ?? text(raw.status, 30).toLowerCase() !== "inativa"),
    alunoIds: uniqueValues(
      safeJsonParse<string[]>(raw.alunoIds ?? raw.aluno_ids_json, []).map((item) => item),
    ),
    presencas: safeJsonParse<SessaoPresenca[]>(raw.presencas ?? raw.presencas_json, []),
    criadaEm: text(raw.criadaEm ?? raw.created_at, 32) || null,
  };
}

function serializeTurma(turma: Turma | TurmaInput) {
  return {
    nome: text(turma.nome, 191),
    modalidade: text(turma.modalidade, 191),
    unidade: text(turma.unidade, 191),
    professorId: text(turma.professorId, 64) || null,
    professor: text(turma.professor, 191),
    diasSemana: turma.diasSemana,
    horarioInicio: text(turma.horarioInicio, 20),
    horarioFim: text(turma.horarioFim, 20),
    capacidadeMaxima: integer(turma.capacidadeMaxima, 0),
    ativa: Boolean(turma.ativa),
    alunoIds: "alunoIds" in turma ? turma.alunoIds : [],
    presencas: "presencas" in turma ? turma.presencas : [],
  };
}

const resource = createMysqlResourceStore<Turma>({
  endpoint: "/turmas",
  initialState: [],
  normalize: (item) => normalizeTurma(item as RawTurma),
  loadAll: () => api.get<Turma[]>("/turmas"),
  createEntity: (entity) => api.post<Turma>("/turmas", serializeTurma(entity)),
  updateEntity: (entity) => api.put<Turma>(`/turmas/${entity.id}`, serializeTurma(entity)),
  deleteEntity: (id) => api.del(`/turmas/${id}`),
});

let state: Turma[] = resource.getSnapshot();
const listeners = new Set<() => void>();

resource.subscribe(() => {
  state = resource.getSnapshot().map((item) => normalizeTurma(item as RawTurma));
  listeners.forEach((listener) => listener());
});

function replaceState(nextState: Turma[]) {
  resource.replaceState(nextState.map((item) => normalizeTurma(item as RawTurma)));
}

function replaceById(targetId: string, nextItem: Turma) {
  replaceState(resource.getSnapshot().map((item) => (item.id === targetId ? nextItem : item)));
}

function persistUpdate(next: Turma) {
  void api.put<Turma>(`/turmas/${next.id}`, serializeTurma(next)).then(
    (saved) => replaceById(next.id, normalizeTurma(saved as RawTurma)),
    async (error) => {
      console.error("[turmas-store] Falha ao salvar turma.", error);
      await resource.reload();
    },
  );
}

export const turmasStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): Turma[] {
    return state;
  },
  load() {
    return resource.reload();
  },
  reload() {
    return resource.reload();
  },
  getById(id: string): Turma | undefined {
    return state.find((turma) => turma.id === String(id));
  },
  create(data: TurmaInput) {
    const optimisticId = `tmp-turma-${Date.now()}`;
    const nova = normalizeTurma({
      ...data,
      id: optimisticId,
      alunoIds: [],
      presencas: [],
      created_at: new Date().toISOString(),
    });
    replaceState([nova, ...resource.getSnapshot()]);
    void api
      .post<Turma>("/turmas", serializeTurma(nova))
      .then((saved) => replaceById(optimisticId, normalizeTurma(saved as RawTurma)))
      .catch(async (error) => {
        console.error("[turmas-store] Falha ao criar turma.", error);
        await resource.reload();
      });
    return nova;
  },
  update(id: string, data: Partial<Omit<Turma, "id" | "alunoIds" | "presencas">>) {
    const current = state.find((turma) => turma.id === String(id));
    if (!current) return null;
    const next = normalizeTurma({ ...current, ...data, id });
    replaceState(resource.getSnapshot().map((turma) => (turma.id === id ? next : turma)));
    persistUpdate(next);
    return next;
  },
  toggleAtiva(id: string) {
    const current = state.find((turma) => turma.id === String(id));
    if (!current) return null;
    const next = normalizeTurma({ ...current, ativa: !current.ativa, id });
    replaceState(resource.getSnapshot().map((turma) => (turma.id === id ? next : turma)));
    persistUpdate(next);
    return next;
  },
  remove(id: string) {
    replaceState(resource.getSnapshot().filter((turma) => turma.id !== String(id)));
    void api.del(`/turmas/${id}`).catch(async (error) => {
      console.error("[turmas-store] Falha ao remover turma.", error);
      await resource.reload();
    });
  },
  adicionarAluno(turmaId: string, alunoId: string): { ok: boolean; reason?: string } {
    const turma = state.find((item) => item.id === String(turmaId));
    if (!turma) return { ok: false, reason: "Turma nao encontrada" };
    if (turma.alunoIds.includes(alunoId)) return { ok: false, reason: "Aluno ja esta nesta turma" };
    if (turma.capacidadeMaxima > 0 && turma.alunoIds.length >= turma.capacidadeMaxima) {
      return { ok: false, reason: "Capacidade maxima atingida" };
    }
    const next = normalizeTurma({ ...turma, alunoIds: [...turma.alunoIds, alunoId] });
    replaceState(resource.getSnapshot().map((item) => (item.id === turmaId ? next : item)));
    persistUpdate(next);
    return { ok: true };
  },
  removerAluno(turmaId: string, alunoId: string) {
    const turma = state.find((item) => item.id === String(turmaId));
    if (!turma) return;
    const next = normalizeTurma({
      ...turma,
      alunoIds: turma.alunoIds.filter((id) => id !== alunoId),
    });
    replaceState(resource.getSnapshot().map((item) => (item.id === turmaId ? next : item)));
    persistUpdate(next);
  },
  registrarPresenca(turmaId: string, data: string, registros: PresencaRegistro[]) {
    const turma = state.find((item) => item.id === String(turmaId));
    if (!turma) return;
    const outras = turma.presencas.filter((sessao) => sessao.data !== data);
    const sessao: SessaoPresenca = {
      id: `sessao-${Date.now()}`,
      data,
      registros,
    };
    const next = normalizeTurma({
      ...turma,
      presencas: [...outras, sessao].sort((left, right) => right.data.localeCompare(left.data)),
    });
    replaceState(resource.getSnapshot().map((item) => (item.id === turmaId ? next : item)));
    persistUpdate(next);
  },
  removerSessao(turmaId: string, sessaoId: string) {
    const turma = state.find((item) => item.id === String(turmaId));
    if (!turma) return;
    const next = normalizeTurma({
      ...turma,
      presencas: turma.presencas.filter((sessao) => sessao.id !== sessaoId),
    });
    replaceState(resource.getSnapshot().map((item) => (item.id === turmaId ? next : item)));
    persistUpdate(next);
  },
};

export function useTurmas(): Turma[] {
  return useSyncExternalStore(
    turmasStore.subscribe,
    turmasStore.getSnapshot,
    turmasStore.getSnapshot,
  );
}

export function useTurmasStatus() {
  return useSyncExternalStore(turmasStore.subscribe, resource.getMeta, resource.getMeta);
}

export function turmasDoAluno(alunoId: string): Turma[] {
  return state.filter((turma) => turma.alunoIds.includes(alunoId));
}

export function statsPresencaAluno(turma: Turma, alunoId: string) {
  let total = 0;
  let presentes = 0;
  for (const sessao of turma.presencas) {
    const registro = sessao.registros.find((item) => item.alunoId === alunoId);
    if (!registro) continue;
    total += 1;
    if (registro.presente) presentes += 1;
  }
  const taxa = total > 0 ? Math.round((presentes / total) * 100) : 0;
  return { total, presentes, faltas: total - presentes, taxa };
}

export function formatDias(dias: DiaSemana[]): string {
  const labels: Record<DiaSemana, string> = {
    seg: "Seg",
    ter: "Ter",
    qua: "Qua",
    qui: "Qui",
    sex: "Sex",
    sab: "Sab",
    dom: "Dom",
  };
  return dias.map((dia) => labels[dia]).join(" · ");
}
