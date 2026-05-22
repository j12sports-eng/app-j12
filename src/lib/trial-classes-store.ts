import { useSyncExternalStore } from "react";
import { alunosStore, type Aluno, type Modalidade } from "./alunos-store";
import { planosStore } from "./planos-store";
import { type TrialClassMockRecord, type TrialClassStatus } from "./trialClassesMock";
import { createRemoteCollectionStore } from "./remote-collection";
import { turmasStore } from "./turmas-store";

export type { TrialClassStatus } from "./trialClassesMock";

export type TrialClassLeadSource =
  | "Instagram"
  | "Indicacao"
  | "Site"
  | "WhatsApp"
  | "Meta Ads"
  | "Evento"
  | "Parceria escolar"
  | "Outro";

export type TrialClassHistoryItem = {
  id: string;
  title: string;
  description: string;
  at: string;
};

export type TrialClass = {
  id: string;
  studentName: string;
  birthDate: string;
  notes: string;
  guardianName: string;
  phone: string;
  whatsapp: string;
  email: string;
  modality: Modalidade;
  unit: string;
  turma: string;
  professor: string;
  date: string;
  time: string;
  status: TrialClassStatus;
  leadSource: TrialClassLeadSource | string;
  convertedAlunoId: string | null;
  history: TrialClassHistoryItem[];
  createdAt: string;
  updatedAt: string;
};

export type TrialClassConvertResult =
  | {
      ok: true;
      aluno: Aluno;
      trialClass: TrialClass;
      turmaWarning?: string;
    }
  | { ok: false; reason: string };

export type TrialClassInput = Omit<
  TrialClass,
  "id" | "convertedAlunoId" | "history" | "createdAt" | "updatedAt"
>;

const STORAGE_KEY = "j12.trial-classes.v1";

export const TRIAL_CLASS_STATUS_OPTIONS: TrialClassStatus[] = [
  "Agendada",
  "Confirmada",
  "Compareceu",
  "N\u00E3o compareceu",
  "Reagendada",
  "Convertida",
  "Cancelada",
];

export const TRIAL_CLASS_LEAD_SOURCES: TrialClassLeadSource[] = [
  "Instagram",
  "Indicacao",
  "Site",
  "WhatsApp",
  "Meta Ads",
  "Evento",
  "Parceria escolar",
  "Outro",
];

function nowIso() {
  return new Date().toISOString();
}

function historyId() {
  return `th${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function emptyHistory(title: string, description: string): TrialClassHistoryItem[] {
  return [
    {
      id: historyId(),
      title,
      description,
      at: nowIso(),
    },
  ];
}

function addHistory(item: TrialClass, title: string, description: string): TrialClassHistoryItem[] {
  return [
    {
      id: historyId(),
      title,
      description,
      at: nowIso(),
    },
    ...item.history,
  ];
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase();
}

function buildStudentEmail(item: TrialClass) {
  return item.email.trim() || `${slug(item.studentName)}@trial.j12.local`;
}

function normalizeModality(value: string): Modalidade {
  return (value || "") as Modalidade;
}

function normalizeStatus(value: string): TrialClassStatus {
  if (TRIAL_CLASS_STATUS_OPTIONS.includes(value as TrialClassStatus)) {
    return value as TrialClassStatus;
  }

  if (value === "Nao compareceu") return "N\u00E3o compareceu";
  return "Agendada";
}

function normalizeLeadSource(value: string): TrialClassLeadSource | string {
  return TRIAL_CLASS_LEAD_SOURCES.find((item) => item === value) ?? value ?? "Outro";
}

function getPlanoCatalog() {
  const dynamicPlanos = planosStore
    .getSnapshot()
    .filter((plano) => plano.status === "ativo")
    .map((plano) => plano.nome.trim())
    .filter(Boolean);

  return Array.from(new Set(dynamicPlanos));
}

function getTurmaCatalog() {
  const dynamicTurmas = turmasStore
    .getSnapshot()
    .map((turma) => turma.nome.trim())
    .filter(Boolean);

  return Array.from(new Set(dynamicTurmas.length > 0 ? dynamicTurmas : ["Sub-11 Tarde"]));
}

function createFromMock(record: TrialClassMockRecord): TrialClass {
  const createdAt = nowIso();
  return {
    id: record.id,
    studentName: record.student_name,
    birthDate: record.birth_date,
    notes: record.notes,
    guardianName: record.guardian_name,
    phone: record.phone,
    whatsapp: record.whatsapp,
    email: record.email,
    modality: normalizeModality(record.modality),
    unit: record.unit,
    turma: record.turma,
    professor: record.teacher,
    date: record.date,
    time: record.time,
    status: normalizeStatus(record.status),
    leadSource: normalizeLeadSource(record.lead_source),
    convertedAlunoId: null,
    history: emptyHistory(
      "Lead cadastrado",
      `Aula experimental criada com status ${normalizeStatus(record.status)}.`,
    ),
    createdAt,
    updatedAt: createdAt,
  };
}

function normalizeTrialClass(item: TrialClass): TrialClass {
  return {
    ...item,
    modality: normalizeModality(item.modality),
    status: normalizeStatus(item.status),
    leadSource: normalizeLeadSource(item.leadSource),
    history: Array.isArray(item.history)
      ? item.history.map((entry) => ({
          id: entry.id || historyId(),
          title: entry.title || "Atualizacao",
          description: entry.description || "Registro do historico.",
          at: entry.at || nowIso(),
        }))
      : emptyHistory("Lead cadastrado", "Registro inicial da aula experimental."),
    convertedAlunoId: item.convertedAlunoId ?? null,
    createdAt: item.createdAt || nowIso(),
    updatedAt: item.updatedAt || item.createdAt || nowIso(),
  };
}

function seedData() {
  return [] as TrialClass[];
}

function load() {
  return seedData();
}

const trialClassesCollection = createRemoteCollectionStore<TrialClass[]>("trial-classes", [], {
  emptyState: [],
});
let state: TrialClass[] = trialClassesCollection.getSnapshot().map(normalizeTrialClass);
const listeners = new Set<() => void>();

trialClassesCollection.subscribe(() => {
  state = trialClassesCollection.getSnapshot().map(normalizeTrialClass);
  listeners.forEach((listener) => listener());
});

function emit() {
  state = state.map(normalizeTrialClass);
  trialClassesCollection.replaceState(state);
}

function createTrialClassId() {
  return `tc${Date.now()}`;
}

function updateOne(id: string, updater: (current: TrialClass) => TrialClass): TrialClass | null {
  let updated: TrialClass | null = null;

  state = state.map((item) => {
    if (item.id !== id) return item;
    updated = updater(item);
    return updated;
  });

  if (updated) emit();
  return updated;
}

export const trialClassesStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return state;
  },
  reload() {
    return trialClassesCollection.reload();
  },
  getById(id: string) {
    return state.find((item) => item.id === id) ?? null;
  },
  create(data: TrialClassInput) {
    const createdAt = nowIso();
    const novo = normalizeTrialClass({
      ...data,
      id: createTrialClassId(),
      convertedAlunoId: null,
      history: emptyHistory(
        "Lead cadastrado",
        `Aula experimental criada para ${data.studentName}.`,
      ),
      createdAt,
      updatedAt: createdAt,
    });

    state = [novo, ...state];
    emit();
    return novo;
  },
  update(id: string, data: TrialClassInput) {
    return updateOne(id, (current) =>
      normalizeTrialClass({
        ...current,
        ...data,
        history: addHistory(
          current,
          "Cadastro atualizado",
          "Dados da aula experimental revisados.",
        ),
        updatedAt: nowIso(),
      }),
    );
  },
  reschedule(id: string, data: TrialClassInput) {
    return updateOne(id, (current) =>
      normalizeTrialClass({
        ...current,
        ...data,
        status: "Reagendada",
        history: addHistory(
          current,
          "Aula reagendada",
          `Novo agendamento para ${data.date} as ${data.time}.`,
        ),
        updatedAt: nowIso(),
      }),
    );
  },
  transition(id: string, status: TrialClassStatus, title: string, description: string) {
    return updateOne(id, (current) =>
      normalizeTrialClass({
        ...current,
        status,
        history: addHistory(current, title, description),
        updatedAt: nowIso(),
      }),
    );
  },
  convertToAluno(id: string, plan?: string): TrialClassConvertResult {
    let result: TrialClassConvertResult = {
      ok: false,
      reason: "Aula experimental nao encontrada.",
    };

    state = state.map((item) => {
      if (item.id !== id) return item;

      if (item.status !== "Compareceu") {
        result = {
          ok: false,
          reason: "Somente aulas com comparecimento podem ser convertidas.",
        };
        return item;
      }

      if (item.convertedAlunoId) {
        result = {
          ok: false,
          reason: "Esta aula experimental ja foi convertida em aluno.",
        };
        return item;
      }

      const planoSelecionado = plan?.trim() || getPlanoCatalog()[0] || "";
      if (!planoSelecionado) {
        result = {
          ok: false,
          reason: "Nenhum plano ativo esta disponivel para concluir a conversao.",
        };
        return item;
      }
      const turmaPadrao = getTurmaCatalog()[0] || "";

      const aluno = alunosStore.create({
        nome: item.studentName,
        email: buildStudentEmail(item),
        telefone: item.whatsapp || item.phone,
        dataNascimento: item.birthDate,
        responsavel: item.guardianName,
        telefoneResponsavel: item.whatsapp || item.phone,
        modalidade: item.modality,
        unidades: item.unit ? [item.unit] : [],
        turmas: item.turma || turmaPadrao ? [item.turma || turmaPadrao] : [],
        planos: planoSelecionado ? [planoSelecionado] : [],
        horarios: item.time ? [`${item.date} ${item.time}`] : [],
        turma: item.turma || turmaPadrao,
        plano: planoSelecionado,
        status: "ativo",
      });

      let turmaWarning: string | undefined;
      const targetTurma = turmasStore.getSnapshot().find((turma) => turma.nome === item.turma);
      if (targetTurma) {
        const enrollment = turmasStore.adicionarAluno(targetTurma.id, aluno.id);
        if (!enrollment.ok) turmaWarning = enrollment.reason;
      }

      const updated = normalizeTrialClass({
        ...item,
        status: "Convertida",
        convertedAlunoId: aluno.id,
        history: addHistory(
          item,
          "Lead convertido",
          `Aluno ${aluno.nome} criado a partir da aula experimental.`,
        ),
        updatedAt: nowIso(),
      });

      result = {
        ok: true,
        aluno,
        trialClass: updated,
        turmaWarning,
      };

      return updated;
    });

    emit();
    return result;
  },
  remove(id: string) {
    state = state.filter((item) => item.id !== id);
    emit();
  },
};

export function useTrialClasses() {
  return useSyncExternalStore(
    trialClassesStore.subscribe,
    trialClassesStore.getSnapshot,
    trialClassesStore.getSnapshot,
  );
}

export function useTrialClassesStatus() {
  return useSyncExternalStore(
    trialClassesStore.subscribe,
    trialClassesCollection.getMeta,
    trialClassesCollection.getMeta,
  );
}

export function calculateTrialClassAge(birthDate: string) {
  if (!birthDate) return null;

  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
}

export function isValidTrialPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11;
}

export function canConfirmTrialClass(item: TrialClass) {
  return item.status === "Agendada" || item.status === "Reagendada";
}

export function canMarkAttendance(item: TrialClass) {
  return item.status === "Agendada" || item.status === "Confirmada" || item.status === "Reagendada";
}

export function canRescheduleTrialClass(item: TrialClass) {
  return item.status !== "Cancelada" && item.status !== "Convertida";
}

export function canConvertTrialClass(item: TrialClass) {
  return item.status === "Compareceu" && !item.convertedAlunoId;
}

export function canCancelTrialClass(item: TrialClass) {
  return item.status !== "Cancelada" && item.status !== "Convertida";
}

export function canEditTrialClass(item: TrialClass) {
  return item.status !== "Convertida";
}
