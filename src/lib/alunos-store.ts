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
  planoNome?: string | null;
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
  unidade?: string | null;
  modalidade?: string | null;
  diasHorarios?: string[] | null;
}

export type TurmaCatalogo = {
  nome: string;
  modalidade: Modalidade;
  unidade: string;
};

export interface Aluno extends Record<string, unknown> {
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
  planoId?: string | null;
  planoNome?: string | null;
  planoValor?: number | null;
  plano_id?: string | null;
  plano_nome?: string | null;
  plano_valor?: number | null;
  mensalidade?: number | null;
  unidade?: string | null;
  dias_horarios?: string[] | string | null;
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

type AlunoInput = Omit<Aluno, "id" | "matriculaEm"> & Record<string, unknown>;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => (value || "").trim()).filter(Boolean)));
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return (value ?? fallback) as T;

  try {
    const parsed = JSON.parse(String(value)) as T;
    if (parsed == null) return fallback;
    if (Array.isArray(fallback)) {
      return (Array.isArray(parsed) ? parsed : fallback) as T;
    }
    if (typeof fallback === "object") {
      return (typeof parsed === "object" ? parsed : fallback) as T;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

function normalizeArrayField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueValues(value.map((item) => String(item ?? "")));
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return [];

    if (
      (normalized.startsWith("[") && normalized.endsWith("]")) ||
      (normalized.startsWith("{") && normalized.endsWith("}"))
    ) {
      try {
        const parsed = JSON.parse(normalized);
        return Array.isArray(parsed) ? uniqueValues(parsed.map((item) => String(item ?? ""))) : [];
      } catch {
        return uniqueValues(normalized.split(/[;,|]/g));
      }
    }

    return uniqueValues(normalized.split(/[;,|]/g));
  }

  return value == null ? [] : [String(value)];
}

function normalizeStudentStatus(value: unknown): StatusAluno {
  const normalized = text(value).toLowerCase();
  if (normalized === "inativo") return "inativo";
  if (normalized === "experimental") return "experimental";
  return "ativo";
}

function normalizePeriodicidade(value: unknown): AlunoPeriodicidadeFinanceira | null {
  const normalized = text(value).toLowerCase();
  switch (normalized) {
    case "mensal":
    case "bimestral":
    case "trimestral":
    case "semestral":
    case "anual":
      return normalized;
    default:
      return null;
  }
}

function normalizeFinanceiroConfig(
  raw: unknown,
  fallback: {
    planoId?: string | null;
    planoNome?: string | null;
    planoValor?: number | null;
    modalidade?: string | null;
    unidade?: string | null;
    diasHorarios?: string[];
  },
): AlunoFinanceiroConfig | undefined {
  const parsed = safeJsonParse<Record<string, unknown>>(raw, {});
  const planoId = text(parsed.planoId ?? fallback.planoId) || null;
  const planoNome = text(parsed.planoNome ?? fallback.planoNome) || null;
  const valorPlano = numeric(parsed.valorPlano ?? parsed.valor ?? fallback.planoValor, 0);
  const diasHorarios = uniqueValues([
    ...normalizeArrayField(parsed.diasHorarios),
    ...normalizeArrayField(fallback.diasHorarios),
  ]);

  const output: AlunoFinanceiroConfig = {
    planoId,
    planoNome,
    valorPlano: valorPlano > 0 ? valorPlano : null,
    periodicidade: normalizePeriodicidade(parsed.periodicidade),
    diaVencimento:
      Number.isFinite(Number(parsed.diaVencimento)) && Number(parsed.diaVencimento) > 0
        ? Math.trunc(Number(parsed.diaVencimento))
        : null,
    dataInicioFinanceiro: text(parsed.dataInicioFinanceiro) || null,
    descontoValor: numeric(parsed.descontoValor, 0) || null,
    descontoPercentual: numeric(parsed.descontoPercentual, 0) || null,
    bolsaValor: numeric(parsed.bolsaValor, 0) || null,
    bolsaPercentual: numeric(parsed.bolsaPercentual, 0) || null,
    multaPercentual: numeric(parsed.multaPercentual, 0) || null,
    jurosDiaPercentual: numeric(parsed.jurosDiaPercentual, 0) || null,
    cobrancaAutomatica:
      parsed.cobrancaAutomatica == null ? null : Boolean(parsed.cobrancaAutomatica),
    recorrenciaAtiva: parsed.recorrenciaAtiva == null ? null : Boolean(parsed.recorrenciaAtiva),
    cobrancaProporcional:
      parsed.cobrancaProporcional == null ? null : Boolean(parsed.cobrancaProporcional),
    observacoes: text(parsed.observacoes) || null,
    unidade: text(parsed.unidade ?? fallback.unidade) || null,
    modalidade: text(parsed.modalidade ?? fallback.modalidade) || null,
    diasHorarios,
  };

  if (
    !output.planoId &&
    !output.planoNome &&
    !output.valorPlano &&
    !output.periodicidade &&
    !output.unidade &&
    !output.modalidade &&
    output.diasHorarios?.length === 0
  ) {
    return undefined;
  }

  return output;
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

export function getAlunoPlanos(
  aluno: Pick<Aluno, "planos" | "plano" | "planoNome" | "plano_nome" | "financeiro">,
) {
  return uniqueValues(
    aluno.planos?.length
      ? aluno.planos
      : [
          aluno.plano,
          aluno.planoNome ?? "",
          aluno.plano_nome ?? "",
          aluno.financeiro?.planoNome ?? "",
        ],
  );
}

export function getAlunoUnidades(
  aluno: Pick<Aluno, "unidades" | "turmas" | "turma" | "matricula" | "unidade" | "financeiro">,
) {
  const turmas = getAlunoTurmas(aluno);
  const fromTurmas = getUnidadesFromTurmas(turmas);
  const fromMatricula = aluno.matricula?.esportivas?.unidades ?? [];
  const fromFinanceiro = aluno.financeiro?.unidade ? [aluno.financeiro.unidade] : [];

  return uniqueValues(
    aluno.unidades?.length
      ? [...aluno.unidades, ...fromTurmas, ...fromMatricula, ...fromFinanceiro]
      : [...fromTurmas, ...fromMatricula, ...fromFinanceiro, aluno.unidade ?? ""],
  );
}

export function getAlunoHorarios(
  aluno: Pick<Aluno, "horarios" | "matricula" | "dias_horarios" | "financeiro">,
) {
  return uniqueValues([
    ...(aluno.horarios?.length ? aluno.horarios : []),
    ...(aluno.matricula?.esportivas?.horarios ?? []),
    ...normalizeArrayField(aluno.dias_horarios),
    ...(aluno.financeiro?.diasHorarios ?? []),
  ]);
}

export function getAlunoModalidades(aluno: Pick<Aluno, "modalidade" | "matricula" | "financeiro">) {
  return uniqueValues(
    aluno.matricula?.esportivas?.modalidades?.length
      ? aluno.matricula.esportivas.modalidades
      : [aluno.financeiro?.modalidade ?? "", aluno.modalidade],
  );
}

export function formatAlunoScope(values: string[]) {
  if (values.length === 0) return "-";
  return values.join(", ");
}

function normalizeAluno(raw: Partial<Aluno> & Record<string, unknown>): Aluno {
  const baseMatricula = normalizeAlunoMatriculaData(
    raw.matricula ?? safeJsonParse(raw.matricula_snapshot_json ?? raw.matricula_json, {}),
  );
  const fallbackMatricula = buildEmptyAlunoMatricula();

  const modalidades = uniqueValues([
    ...normalizeArrayField(baseMatricula.esportivas?.modalidades ?? []),
    ...normalizeArrayField(raw.modalidades_json ?? raw.modalidades),
    text(raw.modalidade ?? raw.modalidade_principal),
  ]);
  const turmas = uniqueValues([
    ...normalizeArrayField(baseMatricula.esportivas?.turmas ?? []),
    ...normalizeArrayField(raw.turmas_json ?? raw.turmas),
    text(raw.turma ?? raw.turma_principal),
  ]);
  const unidades = uniqueValues([
    ...normalizeArrayField(baseMatricula.esportivas?.unidades ?? []),
    ...normalizeArrayField(raw.unidades_json ?? raw.unidades),
    text(raw.unidade ?? raw.unidade_principal),
  ]);
  const horarios = uniqueValues([
    ...normalizeArrayField(baseMatricula.esportivas?.horarios ?? []),
    ...normalizeArrayField(raw.horarios_json ?? raw.horarios),
    ...normalizeArrayField(raw.dias_horarios_json ?? raw.dias_horarios),
  ]);

  const planoId = text(raw.planoId ?? raw.plano_id) || null;
  const planoNome = text(raw.planoNome ?? raw.plano_nome ?? raw.plano ?? raw.plano_principal);
  const planos = uniqueValues([...normalizeArrayField(raw.planos_json ?? raw.planos), planoNome]);
  const planoValor = numeric(raw.planoValor ?? raw.plano_valor, 0) || null;

  const modalidade =
    modalidades[0] ||
    text(baseMatricula.esportivas?.modalidades?.[0]) ||
    text(raw.modalidade ?? raw.modalidade_principal) ||
    getPrimaryModalidadeFromTurmas(turmas, MODALIDADES[0] ?? "Futebol");

  const dataNascimento =
    text(
      raw.dataNascimento ??
        raw.data_nascimento ??
        baseMatricula.dadosAluno?.dataNascimento ??
        raw.matricula?.dadosAluno?.dataNascimento,
    ) || "";

  const financeiro = normalizeFinanceiroConfig(raw.financeiro ?? raw.financeiro_json, {
    planoId,
    planoNome: planoNome || planos[0] || null,
    planoValor,
    modalidade,
    unidade: unidades[0] ?? null,
    diasHorarios: horarios,
  });

  const matricula: AlunoMatriculaData = {
    ...fallbackMatricula,
    ...baseMatricula,
    dadosAluno: {
      ...fallbackMatricula.dadosAluno,
      ...baseMatricula.dadosAluno,
      numeroMatricula:
        text(
          raw.numeroMatricula ?? raw.numero_matricula ?? baseMatricula.dadosAluno.numeroMatricula,
        ) || "",
      nomeCompleto:
        text(raw.nome ?? raw.nome_completo ?? baseMatricula.dadosAluno.nomeCompleto) || "",
      dataNascimento,
      idade: calculateStudentAge(dataNascimento),
      cpf: text(raw.cpf ?? baseMatricula.dadosAluno.cpf) || "",
      rg: text(raw.rg ?? baseMatricula.dadosAluno.rg) || "",
      sexo: text(raw.sexo ?? baseMatricula.dadosAluno.sexo) || "",
      colegio: text(raw.colegio ?? baseMatricula.dadosAluno.colegio) || "",
      periodoEscolar:
        text(
          raw.periodoEscolar ?? raw.periodo_escolar ?? baseMatricula.dadosAluno.periodoEscolar,
        ) || "",
    },
    responsavel: {
      ...fallbackMatricula.responsavel,
      ...baseMatricula.responsavel,
      nomeCompleto:
        text(raw.responsavel ?? raw.responsavel_nome ?? baseMatricula.responsavel.nomeCompleto) ||
        "",
      whatsapp:
        text(
          raw.telefoneResponsavel ??
            raw.telefone_responsavel ??
            raw.responsavel_whatsapp ??
            baseMatricula.responsavel.whatsapp,
        ) || "",
      email:
        text(
          raw.email ??
            raw.email_contato ??
            raw.responsavel_email ??
            baseMatricula.responsavel.email,
        ) || "",
    },
    esportivas: {
      ...fallbackMatricula.esportivas,
      ...baseMatricula.esportivas,
      modalidades: modalidades.length > 0 ? modalidades : [modalidade],
      unidades,
      horarios,
      turmas,
    },
  };

  const nome = text(raw.nome ?? raw.nome_completo) || matricula.dadosAluno.nomeCompleto || "Aluno";
  const email =
    text(raw.email ?? raw.email_contato ?? matricula.responsavel.email ?? raw.responsavel_email) ||
    "";
  const telefone =
    text(raw.telefone ?? raw.telefone_contato ?? matricula.responsavel.whatsapp) || "";
  const status = normalizeStudentStatus(raw.status);
  const matriculaEm =
    text(raw.matriculaEm ?? raw.matricula_em ?? raw.created_at).slice(0, 10) || todayISO();

  return {
    ...raw,
    id: text(raw.id) || `aluno-${Date.now()}`,
    nome,
    email,
    telefone,
    dataNascimento,
    responsavel:
      text(raw.responsavel ?? raw.responsavel_nome) || matricula.responsavel.nomeCompleto,
    telefoneResponsavel:
      text(raw.telefoneResponsavel ?? raw.telefone_responsavel ?? raw.responsavel_whatsapp) ||
      matricula.responsavel.whatsapp,
    modalidade,
    unidades,
    turmas,
    planos,
    horarios,
    turma: text(raw.turma ?? raw.turma_principal) || turmas[0] || "",
    plano: text(raw.plano ?? raw.plano_principal) || planoNome || planos[0] || "",
    status,
    matriculaEm,
    numeroMatricula: matricula.dadosAluno.numeroMatricula || undefined,
    cpf: matricula.dadosAluno.cpf || undefined,
    rg: matricula.dadosAluno.rg || undefined,
    sexo: matricula.dadosAluno.sexo || undefined,
    matricula,
    origemCadastro: text(raw.origemCadastro ?? raw.origem_cadastro) || undefined,
    matriculaPublicaProtocolo:
      text(raw.matriculaPublicaProtocolo ?? raw.matricula_publica_protocolo) || undefined,
    financeiro,
    planoId: planoId ?? financeiro?.planoId ?? null,
    planoNome: planoNome || financeiro?.planoNome || planos[0] || null,
    planoValor: planoValor ?? financeiro?.valorPlano ?? null,
    plano_id: planoId ?? financeiro?.planoId ?? null,
    plano_nome: planoNome || financeiro?.planoNome || planos[0] || null,
    plano_valor: planoValor ?? financeiro?.valorPlano ?? null,
    unidade: unidades[0] ?? financeiro?.unidade ?? null,
    dias_horarios: horarios,
  };
}

const alunosResource = createMysqlResourceStore<Aluno>({
  endpoint: "/alunos",
  initialState: [],
  normalize: normalizeAluno,
  loadAll: getAlunos,
  createEntity: createAluno,
  updateEntity: updateAluno,
  deleteEntity: deleteAluno,
});

let state: Aluno[] = alunosResource.getSnapshot();
const listeners = new Set<() => void>();

alunosResource.subscribe(() => {
  state = alunosResource.getSnapshot();
  listeners.forEach((listener) => listener());
});

function replaceState(nextState: Aluno[]) {
  alunosResource.replaceState(nextState.map((item) => normalizeAluno(item)));
}

function replaceById(targetId: string, nextAluno: Aluno) {
  replaceState(
    alunosResource
      .getSnapshot()
      .map((item) => (item.id === targetId ? normalizeAluno(nextAluno) : item)),
  );
}

export const alunosStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return state;
  },
  reload() {
    return alunosResource.reload();
  },
  getById(id: string) {
    return state.find((aluno) => aluno.id === id);
  },
  create(data: AlunoInput) {
    const optimisticId = `tmp-${Date.now()}`;
    const novo = normalizeAluno({
      ...data,
      id: optimisticId,
      matriculaEm: todayISO(),
    });

    replaceState([novo, ...alunosResource.getSnapshot()]);

    void createAluno(novo)
      .then((saved) => {
        replaceById(optimisticId, normalizeAluno(saved as Record<string, unknown>));
      })
      .catch(async (error) => {
        console.error("[alunos-store] Falha ao criar aluno.", error);
        await alunosResource.reload();
      });

    return novo;
  },
  update(id: string, data: Partial<Aluno> & Record<string, unknown>) {
    const current = state.find((aluno) => aluno.id === id);
    if (!current) return null;

    const next = normalizeAluno({ ...current, ...data, id });
    replaceState(alunosResource.getSnapshot().map((aluno) => (aluno.id === id ? next : aluno)));

    void updateAluno(next)
      .then((saved) => {
        replaceById(id, normalizeAluno(saved as Record<string, unknown>));
      })
      .catch(async (error) => {
        console.error("[alunos-store] Falha ao atualizar aluno.", error);
        await alunosResource.reload();
      });

    return next;
  },
  remove(id: string) {
    if (!state.some((aluno) => aluno.id === id)) return;

    replaceState(alunosResource.getSnapshot().filter((aluno) => aluno.id !== id));

    void deleteAluno(id).catch(async (error) => {
      console.error("[alunos-store] Falha ao remover aluno.", error);
      await alunosResource.reload();
    });
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
