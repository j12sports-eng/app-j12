import { useEffect, useState, useSyncExternalStore } from "react";

import { buildApiUrl } from "./api";

export type AlunoStatus = "ativo" | "inativo" | "experimental" | string;
export type StatusAluno = AlunoStatus;
export type Modalidade = string;

/**
 * DADOS DINÂMICOS - Importar de system-store
 * Não usar valores hardcoded. Sempre usar hooks para dados em tempo real.
 */

export type TurmaCatalogo = {
  id?: string;
  nome: string;
  modalidade: Modalidade;
  unidade: string;
};

export type AlunoMatricula = {
  dadosAluno: {
    numeroMatricula?: string;
    nomeCompleto?: string;
    dataNascimento?: string;
    idade?: string | number;
    cpf?: string;
    rg?: string;
    sexo?: string;
    colegio?: string;
    periodoEscolar?: string;
  };
  responsavel: {
    nomeCompleto?: string;
    cpf?: string;
    rg?: string;
    whatsapp?: string;
    email?: string;
    parentesco?: string;
  };
  endereco: {
    cep?: string;
    rua?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  };
  documentos: {
    fotoPerfilAluno?: any;
    rgCpfAluno?: any;
    rgCpfResponsavel?: any;
    comprovanteEndereco?: any;
    atestadoMedico?: any;
  };
  esportivas: {
    modalidades?: string[];
    unidades?: string[];
    horarios?: string[];
    turmas?: string[];
    nivel?: string;
    treinouAntes?: string;
    caracteristica?: string;
    objetivo?: string;
  };
  saude?: any;
  estrategias?: any;
};

export type Aluno = {
  id: string;
  nome: string;
  nomeCompleto?: string;
  email: string;
  telefone: string;
  telefoneResponsavel?: string;
  responsavel?: string;
  status: AlunoStatus;
  modalidade: string;
  turma: string;
  turmaId?: string | null;
  turma_id?: string | number | null;
  plano: string;
  unidade?: string;
  matriculaEm: string;
  dataNascimento: string;
  numeroMatricula?: string;
  matricula?: AlunoMatricula;
  financeiro?: {
    planoId?: string | number | null;
    valorPlano?: number | string | null;
    periodicidade?: any;
    recorrenciaAtiva?: boolean;
    cobrancaAutomatica?: boolean;
    diaVencimento?: number | string | null;
    dataInicioFinanceiro?: string | null;
    descontoValor?: number | string | null;
    descontoPercentual?: number | string | null;
    bolsaValor?: number | string | null;
    bolsaPercentual?: number | string | null;
    multaPercentual?: number | string | null;
    jurosDiaPercentual?: number | string | null;
    cobrancaProporcional?: boolean;
    observacoes?: string | null;
  };
  planoId?: string | number | null;
  plano_id?: string | number | null;
  planoNome?: string;
  plano_nome?: string;
  planoValor?: number | string | null;
  plano_valor?: number | string | null;
  mensalidade?: number | string | null;
  planos?: Array<string | number>;
  raw?: any;
};

let alunosState: Aluno[] = [];
let loadingState = false;
let errorState: string | null = null;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot() {
  return alunosState;
}

export function getLoadingSnapshot() {
  return loadingState;
}

export function getErrorSnapshot() {
  return errorState;
}

function safeJsonParse(value: any, fallback: any = null) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function arrayFromAny(value: any): string[] {
  if (!value) return [];

  const parsed = safeJsonParse(value, value);

  if (Array.isArray(parsed)) {
    return parsed.filter(Boolean).map(String);
  }

  if (typeof parsed === "string") {
    const trimmed = parsed.trim();

    if (!trimmed) return [];

    const jsonParsed = safeJsonParse(trimmed, null);

    if (Array.isArray(jsonParsed)) {
      return jsonParsed.filter(Boolean).map(String);
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeComparable(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function firstValue(...values: any[]) {
  return values.find(
    (value) => value !== undefined && value !== null && String(value).trim() !== "",
  );
}

function isAlunoLike(value: any) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value.id !== undefined ||
      value.aluno_id !== undefined ||
      value.nome !== undefined ||
      value.nome_completo !== undefined ||
      value.nomeCompleto !== undefined)
  );
}

export function extractAlunoList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.data,
    payload?.alunos,
    payload?.items,
    payload?.rows,
    payload?.results,
    payload?.data?.alunos,
    payload?.data?.items,
    payload?.data?.rows,
    payload?.data?.results,
    payload?.data?.data,
    payload?.data?.data?.alunos,
    payload?.data?.data?.items,
    payload?.data?.data?.rows,
    payload?.data?.data?.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }

    if (isAlunoLike(candidate)) {
      return [candidate];
    }
  }

  if (isAlunoLike(payload)) {
    return [payload];
  }

  return [];
}

function normalizeStatus(status: any): AlunoStatus {
  const value = String(status || "ativo").toLowerCase();

  if (value.includes("experimental")) return "experimental";
  if (value.includes("inativo")) return "inativo";
  if (value.includes("ativo")) return "ativo";

  return value || "ativo";
}

function buildMatricula(raw: any): AlunoMatricula {
  const snapshot = safeJsonParse(raw.matricula_snapshot_json, {});
  const dadosAluno = snapshot?.dadosAluno || {};
  const responsavel = snapshot?.responsavel || {};
  const endereco = snapshot?.endereco || {};
  const documentos = snapshot?.documentos || {};
  const esportivas = snapshot?.esportivas || {};

  return {
    dadosAluno: {
      numeroMatricula: firstValue(
        dadosAluno.numeroMatricula,
        raw.numero_matricula,
        raw.matricula_numero,
      ),
      nomeCompleto: firstValue(dadosAluno.nomeCompleto, raw.nome_completo, raw.nome),
      dataNascimento: firstValue(dadosAluno.dataNascimento, raw.data_nascimento),
      idade: firstValue(dadosAluno.idade, raw.idade),
      cpf: firstValue(dadosAluno.cpf, raw.cpf),
      rg: firstValue(dadosAluno.rg, raw.rg),
      sexo: firstValue(dadosAluno.sexo, raw.sexo),
      colegio: firstValue(dadosAluno.colegio, raw.colegio),
      periodoEscolar: firstValue(dadosAluno.periodoEscolar, raw.periodo_escolar),
    },
    responsavel: {
      nomeCompleto: firstValue(responsavel.nomeCompleto, raw.responsavel_nome, raw.responsavel),
      cpf: firstValue(responsavel.cpf, raw.responsavel_cpf),
      rg: firstValue(responsavel.rg, raw.responsavel_rg),
      whatsapp: firstValue(
        responsavel.whatsapp,
        raw.responsavel_whatsapp,
        raw.telefone_responsavel,
      ),
      email: firstValue(responsavel.email, raw.responsavel_email, raw.email_contato),
      parentesco: firstValue(responsavel.parentesco, raw.responsavel_parentesco),
    },
    endereco: {
      cep: firstValue(endereco.cep, raw.cep),
      rua: firstValue(endereco.rua, raw.rua),
      numero: firstValue(endereco.numero, raw.numero),
      complemento: firstValue(endereco.complemento, raw.complemento),
      bairro: firstValue(endereco.bairro, raw.bairro),
      cidade: firstValue(endereco.cidade, raw.cidade),
      estado: firstValue(endereco.estado, raw.estado),
    },
    documentos: {
      fotoPerfilAluno: documentos.fotoPerfilAluno || raw.foto_perfil_aluno_json,
      rgCpfAluno: documentos.rgCpfAluno || raw.rg_cpf_aluno_json,
      rgCpfResponsavel: documentos.rgCpfResponsavel || raw.rg_cpf_responsavel_json,
      comprovanteEndereco: documentos.comprovanteEndereco || raw.comprovante_endereco_json,
      atestadoMedico: documentos.atestadoMedico || raw.atestado_medico_json,
    },
    esportivas: {
      modalidades: arrayFromAny(
        firstValue(esportivas.modalidades, raw.modalidades_json, raw.modalidade_principal),
      ),
      unidades: arrayFromAny(
        firstValue(esportivas.unidades, raw.unidades_json, raw.unidade_principal),
      ),
      horarios: arrayFromAny(
        firstValue(esportivas.horarios, raw.dias_horarios_json, raw.dias_horarios),
      ),
      turmas: arrayFromAny(firstValue(esportivas.turmas, raw.turmas_json, raw.turma_principal)),
      nivel: firstValue(esportivas.nivel, raw.nivel),
      treinouAntes: firstValue(esportivas.treinouAntes, raw.treinou_antes),
      caracteristica: firstValue(esportivas.caracteristica, raw.caracteristica),
      objetivo: firstValue(esportivas.objetivo, raw.objetivo),
    },
    saude: snapshot?.saude || {},
    estrategias: snapshot?.estrategias || {},
  };
}

function normalizeAluno(raw: any): Aluno {
  const matricula = buildMatricula(raw);

  const nome = firstValue(
    raw.nome,
    raw.nome_completo,
    raw.nomeCompleto,
    matricula.dadosAluno.nomeCompleto,
    "Aluno sem nome",
  );

  const modalidade = firstValue(
    raw.modalidade,
    raw.modalidade_principal,
    raw.modalidade_nome,
    matricula.esportivas.modalidades?.[0],
    "",
  );

  const turma = firstValue(
    raw.turma,
    raw.turma_principal,
    raw.turma_nome,
    matricula.esportivas.turmas?.[0],
    "",
  );

  const plano = firstValue(raw.plano, raw.plano_nome, raw.plano_principal, raw.planoNome, "");

  return {
    id: String(raw.id ?? raw.aluno_id ?? raw.codigo ?? crypto.randomUUID()),
    nome: String(nome),
    nomeCompleto: String(firstValue(raw.nome_completo, raw.nomeCompleto, nome)),
    email: String(firstValue(raw.email, raw.email_contato, raw.responsavel_email, "")),
    telefone: String(firstValue(raw.telefone, raw.telefone_contato, raw.whatsapp, "")),
    telefoneResponsavel: String(firstValue(raw.telefone_responsavel, raw.responsavel_whatsapp, "")),
    responsavel: String(
      firstValue(raw.responsavel, raw.responsavel_nome, matricula.responsavel.nomeCompleto, ""),
    ),
    status: normalizeStatus(raw.status),
    modalidade: String(modalidade),
    turma: String(turma),
    turmaId:
      firstValue(raw.turmaId, raw.turma_id, raw.id_turma, raw.turma_codigo, null) == null
        ? null
        : String(firstValue(raw.turmaId, raw.turma_id, raw.id_turma, raw.turma_codigo)),
    turma_id: firstValue(raw.turma_id, raw.turmaId, raw.id_turma, raw.turma_codigo, null),
    plano: String(plano),
    planoId: raw.planoId ?? raw.plano_id ?? raw.financeiro?.planoId ?? null,
    plano_id: raw.plano_id ?? raw.planoId ?? raw.financeiro?.planoId ?? null,
    planoNome: String(firstValue(raw.planoNome, raw.plano_nome, plano)),
    plano_nome: String(firstValue(raw.plano_nome, raw.planoNome, plano)),
    planoValor: raw.planoValor ?? raw.plano_valor ?? raw.mensalidade ?? raw.financeiro?.valorPlano,
    plano_valor: raw.plano_valor ?? raw.planoValor ?? raw.mensalidade ?? raw.financeiro?.valorPlano,
    mensalidade: raw.mensalidade ?? raw.plano_valor ?? raw.planoValor ?? raw.financeiro?.valorPlano,
    financeiro: raw.financeiro,
    planos: arrayFromAny(firstValue(raw.planos, raw.planos_json, raw.plano, plano)),
    unidade: String(
      firstValue(raw.unidade, raw.unidade_principal, matricula.esportivas.unidades?.[0], ""),
    ),
    matriculaEm: String(firstValue(raw.matricula_em, raw.created_at, raw.data_matricula, "")),
    dataNascimento: String(
      firstValue(raw.data_nascimento, matricula.dadosAluno.dataNascimento, ""),
    ),
    numeroMatricula: String(
      firstValue(raw.numero_matricula, matricula.dadosAluno.numeroMatricula, ""),
    ),
    matricula,
    raw,
  };
}

export async function loadAlunos(): Promise<Aluno[]> {
  loadingState = true;

  errorState = null;

  emit();

  try {
    const token = localStorage.getItem("j12_auth_token") || "";

    const response = await fetch(buildApiUrl("/alunos"), {
      method: "GET",

      headers: {
        "Content-Type": "application/json",

        Authorization: `Bearer ${token}`,
      },

      cache: "no-store",
    });

    console.log("[alunos-store] STATUS:", response.status);

    const data = await response.json();

    console.log("[alunos-store] DATA:", data);

    if (!response.ok) {
      throw new Error(data?.message || data?.error || `Erro ${response.status} ao carregar alunos`);
    }

    const lista = extractAlunoList(data);

    console.log("[alunos-store] TOTAL:", lista.length);

    const normalizados = lista.map((item) => normalizeAluno(item));

    alunosState = normalizados;

    emit();

    return normalizados;
  } catch (error: any) {
    console.error("[alunos-store] ERRO:", error);

    errorState = error?.message || "Erro ao carregar alunos";

    alunosState = [];

    emit();

    return [];
  } finally {
    loadingState = false;

    emit();
  }
}

function serializeAlunoMutation(aluno: Partial<Aluno> & Record<string, unknown>) {
  return {
    nome_completo: String(aluno.nomeCompleto ?? aluno.nome ?? "").trim(),
    email_contato: String(aluno.email ?? "").trim(),
    telefone_contato: String(aluno.telefone ?? "").trim(),
  };
}

export async function reloadAlunos(): Promise<Aluno[]> {
  return loadAlunos();
}

export const alunosStore = {
  subscribe,

  getSnapshot() {
    return alunosState;
  },

  getById: getAlunoById,

  load: loadAlunos,

  reload: reloadAlunos,

  create(payload: Partial<Aluno> & Record<string, unknown>) {
    const next = normalizeAluno({
      ...payload,
      id: `tmp-aluno-${Date.now()}`,
      nome: payload.nome ?? payload.nomeCompleto ?? "Aluno",
      nome_completo: payload.nomeCompleto ?? payload.nome,
      email_contato: payload.email,
      telefone_contato: payload.telefone,
      status: payload.status ?? "ativo",
      created_at: new Date().toISOString(),
    });

    alunosState = [next, ...alunosState];

    emit();

    return next;
  },

  update(id: string | number, payload: Partial<Aluno> & Record<string, unknown>) {
    const current = getAlunoById(id);

    if (!current) {
      return null;
    }

    const next = normalizeAluno({
      ...current,
      ...payload,
      id: current.id,
    });

    alunosState = alunosState.map((aluno) => {
      return String(aluno.id) === String(id) ? next : aluno;
    });

    emit();

    fetch(buildApiUrl(`/alunos/${id}`), {
      method: "PUT",

      headers: {
        "Content-Type": "application/json",

        Authorization: `Bearer ${localStorage.getItem("j12_auth_token") || ""}`,
      },

      body: JSON.stringify(
        serializeAlunoMutation({
          ...current,
          ...payload,
        }),
      ),
    })
      .then(() => {
        reloadAlunos();
      })
      .catch(() => {
        reloadAlunos();
      });

    return next;
  },
};

export function useAlunosError() {
  const [error, setError] = useState(errorState);

  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setError(errorState);
    });

    return unsubscribe;
  }, []);

  return error;
}

export function useAlunos(): Aluno[] {
  const alunos = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!alunosState.length && !loadingState) {
      loadAlunos();
    }
  }, []);

  return alunos;
}

export function useAlunosLoading(): boolean {
  return useSyncExternalStore(subscribe, getLoadingSnapshot, getLoadingSnapshot);
}

export function formatAlunoScope(
  values: Array<string | undefined | null> | string | undefined | null,
) {
  if (!values) return "—";

  if (Array.isArray(values)) {
    const clean = values.filter(Boolean).map(String);
    return clean.length ? clean.join(", ") : "—";
  }

  return String(values).trim() || "—";
}

export function getAlunoModalidades(aluno: Aluno | null | undefined): string[] {
  if (!aluno) return [];

  return aluno.matricula?.esportivas?.modalidades?.length
    ? aluno.matricula.esportivas.modalidades
    : arrayFromAny(aluno.modalidade);
}

export function getAlunoTurmas(aluno: Aluno | null | undefined): string[] {
  if (!aluno) return [];

  return aluno.matricula?.esportivas?.turmas?.length
    ? aluno.matricula.esportivas.turmas
    : arrayFromAny(aluno.turma);
}

export function getAlunoTurmaIds(aluno: Aluno | null | undefined): string[] {
  if (!aluno) return [];

  return arrayFromAny(
    firstValue(
      aluno.turmaId,
      aluno.turma_id,
      aluno.raw?.turmaId,
      aluno.raw?.turma_id,
      aluno.raw?.id_turma,
      aluno.raw?.turma_codigo,
      aluno.raw?.turma_ids,
      aluno.raw?.turma_ids_json,
    ),
  );
}

export function alunoPertenceATurma(
  aluno: Aluno | null | undefined,
  turma: { id?: string | number | null; nome?: string | null; alunoIds?: Array<string | number> } | null | undefined,
) {
  if (!aluno || !turma) return false;

  const alunoId = String(aluno.id);
  const turmaAlunoIds = new Set((turma.alunoIds ?? []).map((id) => String(id)));
  if (turmaAlunoIds.has(alunoId)) return true;

  const turmaId = String(turma.id ?? "").trim();
  if (turmaId && getAlunoTurmaIds(aluno).some((id) => String(id) === turmaId)) return true;

  const turmaNome = normalizeComparable(turma.nome);
  if (!turmaNome) return false;

  const nomesDoAluno = [
    ...getAlunoTurmas(aluno),
    aluno.turma,
    aluno.raw?.turma,
    aluno.raw?.turma_nome,
    aluno.raw?.turma_principal,
    aluno.raw?.nome_turma,
  ];

  return nomesDoAluno.some((nome) => normalizeComparable(nome) === turmaNome);
}

export function getAlunosDaTurma<
  T extends { id?: string | number | null; nome?: string | null; alunoIds?: Array<string | number> },
>(turma: T | null | undefined, lista: Aluno[] = alunosState) {
  if (!turma) return [];

  return lista
    .filter((aluno) => alunoPertenceATurma(aluno, turma))
    .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"));
}

export function getAlunoUnidades(aluno: Aluno | null | undefined): string[] {
  if (!aluno) return [];

  return aluno.matricula?.esportivas?.unidades?.length
    ? aluno.matricula.esportivas.unidades
    : arrayFromAny(aluno.unidade);
}

export function getAlunoHorarios(aluno: Aluno | null | undefined): string[] {
  if (!aluno) return [];

  return aluno.matricula?.esportivas?.horarios || [];
}

export function getAlunoPlanos(aluno: Aluno | null | undefined): string[] {
  if (!aluno) return [];

  return arrayFromAny(aluno.plano);
}

export function getAlunoById(id: string | number) {
  return alunosState.find((aluno) => String(aluno.id) === String(id)) ?? null;
}

export function alunoStatusClass(status: AlunoStatus) {
  switch (normalizeStatus(status)) {
    case "ativo":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "experimental":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    case "inativo":
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
    default:
      return "border-white/10 bg-white/5 text-white";
  }
}

export function alunoStatusLabel(status: AlunoStatus) {
  switch (normalizeStatus(status)) {
    case "ativo":
      return "Ativo";
    case "experimental":
      return "Experimental";
    case "inativo":
      return "Inativo";
    default:
      return String(status || "—");
  }
}

/**
 * DINÂMICOS - Dados carregados do backend
 * Importação lazada para evitar circular dependencies
 */

export function useModalidadesDinamicas() {
  try {
    const { useModalidades } = require("./modalidades-store");
    return useModalidades();
  } catch {
    return [];
  }
}

export function useUnidadesDinamicas() {
  try {
    const { useUnidades } = require("./unidades-store");
    return useUnidades();
  } catch {
    return [];
  }
}

export function useTurmasDinamicas() {
  try {
    const { useTurmas } = require("./turmas-store");
    return useTurmas();
  } catch {
    return [];
  }
}

/**
 * Legacy exports para compatibilidade
 * DEPRECATED: Use hooks dinâmicos acima
 */
export function getModalidadesLegacy(): Modalidade[] {
  try {
    const { modalidadesStore } = require("./modalidades-store");
    const snapshot = modalidadesStore.getSnapshot();
    return snapshot
      .filter((m: any) => m.ativa !== false)
      .map((m: any) => m.nome || String(m.id));
  } catch {
    // Fallback para dados estáticos se store não inicializado
    return [];
  }
}

export function getUnidadesLegacy(): string[] {
  try {
    const { unidadesStore } = require("./unidades-store");
    const snapshot = unidadesStore.getSnapshot();
    return snapshot.map((u: any) => u.nome || String(u.id));
  } catch {
    return [];
  }
}
