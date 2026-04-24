import { useSyncExternalStore } from "react";
import {
  buildEmptyAlunoMatricula,
  calculateStudentAge,
  normalizeAlunoMatriculaData,
  type AlunoMatriculaData,
} from "./aluno-matricula";
import { createAluno, deleteAluno, getAlunos, updateAluno } from "./alunos-api";
import { createMysqlResourceStore } from "./mysql-resource-store";

export type StatusAluno = "ativo" | "inativo" | "experimental";
export type Modalidade = string;
export type AlunoPeriodicidadeFinanceira =
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";

export interface AlunoFinanceiroConfig {
  planoId?: string | null;
  valorPlano?: number | null;
  periodicidade?: AlunoPeriodicidadeFinanceira | null;
  diaVencimento?: number | null;
  dataInicioFinanceiro?: string | null;
  descontoValor?: number | null;
  descontoPercentual?: number | null;
  bolsaValor?: number | null;
  bolsaPercentual?: number | null;
  multaPercentual?: number | null;
  jurosDiaPercentual?: number | null;
  cobrancaAutomatica?: boolean | null;
  recorrenciaAtiva?: boolean | null;
  cobrancaProporcional?: boolean | null;
  observacoes?: string | null;
}

export type TurmaCatalogo = {
  nome: string;
  modalidade: Modalidade;
  unidade: string;
};

export interface Aluno {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  dataNascimento: string;
  responsavel?: string;
  telefoneResponsavel?: string;
  modalidade: Modalidade;
  unidades: string[];
  turmas: string[];
  planos: string[];
  horarios?: string[];
  turma: string;
  plano: string;
  status: StatusAluno;
  matriculaEm: string;
  numeroMatricula?: string;
  cpf?: string;
  rg?: string;
  sexo?: string;
  matricula?: AlunoMatriculaData;
  origemCadastro?: string;
  matriculaPublicaProtocolo?: string;
  financeiro?: AlunoFinanceiroConfig;
}

export const MODALIDADES: Modalidade[] = ["Futebol", "Futsal", "Volei", "Basquete", "Natacao"];
export const TURMA_CATALOGO: TurmaCatalogo[] = [
  { nome: "Sub-9 Manha", modalidade: "Futebol", unidade: "Unidade Zona Norte" },
  { nome: "Sub-11 Tarde", modalidade: "Futebol", unidade: "Unidade Centro" },
  { nome: "Sub-13 Tarde", modalidade: "Volei", unidade: "Unidade Centro" },
  { nome: "Sub-15 Noite", modalidade: "Futsal", unidade: "Unidade Zona Sul" },
  { nome: "Adulto Noite", modalidade: "Basquete", unidade: "Unidade Centro" },
];
export const TURMAS = TURMA_CATALOGO.map((turma) => turma.nome);
export const UNIDADES = Array.from(new Set(TURMA_CATALOGO.map((turma) => turma.unidade)));
export const PLANOS = ["Mensal Basico", "Mensal Plus", "Trimestral", "Semestral", "Anual"];

const seed: Aluno[] = [
  {
    id: "a1",
    nome: "Lucas Almeida",
    email: "lucas.almeida@email.com",
    telefone: "(11) 98123-4567",
    dataNascimento: "2014-03-12",
    responsavel: "Carla Almeida",
    telefoneResponsavel: "(11) 99888-1122",
    modalidade: "Futebol",
    unidades: ["Unidade Centro", "Unidade Zona Norte"],
    turmas: ["Sub-11 Tarde", "Sub-9 Manha"],
    planos: ["Mensal Plus", "Trimestral"],
    turma: "Sub-11 Tarde",
    plano: "Mensal Plus",
    status: "ativo",
    matriculaEm: "2024-02-10",
  },
  {
    id: "a2",
    nome: "Mariana Souza",
    email: "mari.souza@email.com",
    telefone: "(11) 97777-3344",
    dataNascimento: "2012-07-22",
    responsavel: "Paulo Souza",
    telefoneResponsavel: "(11) 98765-1010",
    modalidade: "Volei",
    unidades: ["Unidade Centro"],
    turmas: ["Sub-13 Tarde"],
    planos: ["Trimestral"],
    turma: "Sub-13 Tarde",
    plano: "Trimestral",
    status: "ativo",
    matriculaEm: "2023-11-05",
  },
];

type AlunoInput = Omit<Aluno, "id" | "matriculaEm">;

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function getUnidadesFromTurmas(turmas: string[]) {
  return uniqueValues(
    turmas
      .map((turmaNome) => TURMA_CATALOGO.find((turma) => turma.nome === turmaNome)?.unidade)
      .filter((unidade): unidade is string => Boolean(unidade)),
  );
}

export function getPrimaryModalidadeFromTurmas(
  turmas: string[],
  fallback: Modalidade = MODALIDADES[0] ?? "Futebol",
): Modalidade {
  return (
    turmas
      .map((turmaNome) => TURMA_CATALOGO.find((turma) => turma.nome === turmaNome)?.modalidade)
      .find((modalidade): modalidade is Modalidade => Boolean(modalidade)) ?? fallback
  );
}

export function getAlunoTurmas(aluno: Pick<Aluno, "turmas" | "turma">) {
  return uniqueValues(aluno.turmas?.length ? aluno.turmas : [aluno.turma]);
}

export function getAlunoPlanos(aluno: Pick<Aluno, "planos" | "plano">) {
  return uniqueValues(aluno.planos?.length ? aluno.planos : [aluno.plano]);
}

export function getAlunoUnidades(
  aluno: Pick<Aluno, "unidades" | "turmas" | "turma" | "matricula">,
) {
  const turmas = getAlunoTurmas(aluno);
  const fromTurmas = getUnidadesFromTurmas(turmas);
  const fromMatricula = aluno.matricula?.esportivas?.unidades ?? [];
  return uniqueValues(
    aluno.unidades?.length
      ? [...aluno.unidades, ...fromTurmas, ...fromMatricula]
      : [...fromTurmas, ...fromMatricula],
  );
}

export function getAlunoHorarios(aluno: Pick<Aluno, "horarios" | "matricula">) {
  return uniqueValues(
    aluno.horarios?.length ? aluno.horarios : aluno.matricula?.esportivas?.horarios ?? [],
  );
}

export function getAlunoModalidades(aluno: Pick<Aluno, "modalidade" | "matricula">) {
  return uniqueValues(
    aluno.matricula?.esportivas?.modalidades?.length
      ? aluno.matricula.esportivas.modalidades
      : [aluno.modalidade],
  );
}

export function formatAlunoScope(values: string[]) {
  if (values.length === 0) return "-";
  return values.join(", ");
}

function normalizeAluno(aluno: Aluno): Aluno {
  const turmas = getAlunoTurmas(aluno);
  const planos = getAlunoPlanos(aluno);
  const modalidade =
    aluno.modalidade ||
    aluno.matricula?.esportivas?.modalidades?.[0] ||
    getPrimaryModalidadeFromTurmas(turmas, MODALIDADES[0] ?? "Futebol");
  const baseMatricula = normalizeAlunoMatriculaData(aluno.matricula);
  const fallbackMatricula = buildEmptyAlunoMatricula();
  const dataNascimento = baseMatricula.dadosAluno.dataNascimento || aluno.dataNascimento || "";
  const matricula: AlunoMatriculaData = {
    ...fallbackMatricula,
    ...baseMatricula,
    dadosAluno: {
      ...fallbackMatricula.dadosAluno,
      ...baseMatricula.dadosAluno,
      numeroMatricula: baseMatricula.dadosAluno.numeroMatricula || aluno.numeroMatricula || "",
      nomeCompleto: baseMatricula.dadosAluno.nomeCompleto || aluno.nome || "",
      dataNascimento,
      idade: calculateStudentAge(dataNascimento),
      cpf: baseMatricula.dadosAluno.cpf || aluno.cpf || "",
      rg: baseMatricula.dadosAluno.rg || aluno.rg || "",
      sexo: baseMatricula.dadosAluno.sexo || aluno.sexo || "",
    },
    responsavel: {
      ...fallbackMatricula.responsavel,
      ...baseMatricula.responsavel,
      nomeCompleto: baseMatricula.responsavel.nomeCompleto || aluno.responsavel || "",
      whatsapp: baseMatricula.responsavel.whatsapp || aluno.telefoneResponsavel || "",
      email: baseMatricula.responsavel.email || aluno.email || "",
    },
    esportivas: {
      ...fallbackMatricula.esportivas,
      ...baseMatricula.esportivas,
      modalidades: uniqueValues(
        baseMatricula.esportivas.modalidades.length > 0
          ? baseMatricula.esportivas.modalidades
          : [modalidade],
      ),
      unidades: uniqueValues([...baseMatricula.esportivas.unidades, ...(aluno.unidades ?? [])]),
      horarios: uniqueValues([...baseMatricula.esportivas.horarios, ...(aluno.horarios ?? [])]),
      turmas: uniqueValues([...baseMatricula.esportivas.turmas, ...turmas]),
    },
  };
  const unidades = getAlunoUnidades({ ...aluno, turmas, matricula });
  const horarios = getAlunoHorarios({ ...aluno, matricula });

  return {
    ...aluno,
    turmas,
    planos,
    unidades,
    horarios,
    turma: turmas[0] ?? aluno.turma ?? "",
    plano: planos[0] ?? aluno.plano ?? "",
    modalidade,
    responsavel: aluno.responsavel ?? matricula.responsavel.nomeCompleto,
    telefoneResponsavel: aluno.telefoneResponsavel ?? matricula.responsavel.whatsapp,
    numeroMatricula: aluno.numeroMatricula ?? matricula.dadosAluno.numeroMatricula,
    cpf: aluno.cpf ?? matricula.dadosAluno.cpf,
    rg: aluno.rg ?? matricula.dadosAluno.rg,
    sexo: aluno.sexo ?? matricula.dadosAluno.sexo,
    matricula,
    financeiro: aluno.financeiro ?? undefined,
  };
}

const alunosResource = createMysqlResourceStore<Aluno>({
  endpoint: "/alunos",
  initialState: seed,
  normalize: normalizeAluno,
  loadAll: getAlunos,
  createEntity: createAluno,
  updateEntity: updateAluno,
  deleteEntity: deleteAluno,
});

let state: Aluno[] = alunosResource.getSnapshot().map(normalizeAluno);
const listeners = new Set<() => void>();

alunosResource.subscribe(() => {
  state = alunosResource.getSnapshot().map(normalizeAluno);
  listeners.forEach((listener) => listener());
});

function emit(nextState: Aluno[]) {
  state = nextState.map(normalizeAluno);
  alunosResource.replaceState(state);
}

export const alunosStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return state;
  },
  getById(id: string): Aluno | undefined {
    return state.find((aluno) => aluno.id === id);
  },
  create(data: AlunoInput) {
    const novo = normalizeAluno({
      ...data,
      id: `a${Date.now()}`,
      matriculaEm: new Date().toISOString().slice(0, 10),
    });
    emit([novo, ...state]);
    alunosResource.persistCreate(novo);
    return novo;
  },
  update(id: string, data: Partial<Aluno>) {
    const nextState = state.map((aluno) =>
      aluno.id === id ? normalizeAluno({ ...aluno, ...data }) : aluno,
    );
    const updated = nextState.find((aluno) => aluno.id === id);
    emit(nextState);
    if (updated) alunosResource.persistUpdate(updated);
  },
  remove(id: string) {
    emit(state.filter((aluno) => aluno.id !== id));
    alunosResource.persistDelete(id);
  },
};

export function useAlunos(): Aluno[] {
  return useSyncExternalStore(
    alunosStore.subscribe,
    alunosStore.getSnapshot,
    alunosStore.getSnapshot,
  );
}

export function useAlunosStatus() {
  return useSyncExternalStore(
    alunosStore.subscribe,
    alunosResource.getMeta,
    alunosResource.getMeta,
  );
}
