import type { Aluno } from "./alunos-store";
import { normalizeAlunoStatus } from "./aluno-status";
import { getStoredAuthToken } from "@/lib/auth-storage";
import { buildApiUrl } from "@/lib/api";

type ApiPlano = {
  id?: string | number;
  nome?: string;
  name?: string;
  plano_nome?: string;
  valor?: number | string;
  precoMensal?: number | string;
  preco?: number | string;
  mensalidade?: number | string;
};

type ApiTurma = {
  id?: string | number;
  nome?: string;
  name?: string;
  titulo?: string;
  turma?: string;
  modalidade?: string;
  horario?: string;
  alunoIds?: Array<string | number>;
};

type ApiResponsavel = {
  id?: string | number;
  nome?: string;
  nomeCompleto?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  alunoId?: string | number;
};

async function apiGet<T>(path: string): Promise<T> {
  const url = buildApiUrl(path);

  const token = getStoredAuthToken();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ${response.status} ao buscar ${path}`);
  }

  return response.json();
}

async function apiSend<T>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  const url = buildApiUrl(path);

  const token = getStoredAuthToken();

  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Erro ${response.status} em ${method} ${path}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  if (
    data &&
    typeof data === "object" &&
    "data" in data &&
    Array.isArray((data as { data?: unknown }).data)
  ) {
    return (data as { data: T[] }).data;
  }

  if (
    data &&
    typeof data === "object" &&
    "rows" in data &&
    Array.isArray((data as { rows?: unknown }).rows)
  ) {
    return (data as { rows: T[] }).rows;
  }

  if (
    data &&
    typeof data === "object" &&
    "items" in data &&
    Array.isArray((data as { items?: unknown }).items)
  ) {
    return (data as { items: T[] }).items;
  }

  return [];
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeId(value: unknown): string {
  return String(value ?? "").trim();
}

function getPlanoNome(planos: ApiPlano[], aluno: any): string {
  const planoAtual = normalizeText(
    aluno.plano ?? aluno.planoNome ?? aluno.plano_nome ?? aluno.plano_principal ?? aluno.planoName,
  );

  if (planoAtual && planoAtual !== "-") return planoAtual;

  const planoId = normalizeId(aluno.planoId ?? aluno.plano_id ?? aluno.financeiro?.planoId);

  const plano = planos.find((item) => {
    const itemId = normalizeId(item.id);
    return itemId && planoId && itemId === planoId;
  });

  return normalizeText(plano?.nome ?? plano?.name ?? plano?.plano_nome) || "-";
}

function getTurmaNome(turmas: ApiTurma[], aluno: any): string {
  const turmaAtual = normalizeText(
    aluno.turma ?? aluno.turmaNome ?? aluno.turma_nome ?? aluno.turma_principal ?? aluno.nomeTurma,
  );

  if (turmaAtual && turmaAtual !== "-") return turmaAtual;

  const alunoId = normalizeId(aluno.id);

  const turmaId = normalizeId(aluno.turmaId ?? aluno.turma_id ?? aluno.matricula?.turmaId);

  const turma =
    turmas.find((item) => normalizeId(item.id) === turmaId) ??
    turmas.find(
      (item) =>
        Array.isArray(item.alunoIds) && item.alunoIds.some((id) => normalizeId(id) === alunoId),
    );

  return normalizeText(turma?.nome ?? turma?.name ?? turma?.titulo ?? turma?.turma) || "-";
}

function getResponsavelNome(responsaveis: ApiResponsavel[], aluno: any): string {
  const direto = normalizeText(
    aluno.responsavel ??
      aluno.responsavelNome ??
      aluno.responsavel_nome ??
      aluno.nomeResponsavel ??
      aluno.matricula?.responsavel?.nomeCompleto,
  );

  if (direto && direto !== "-") return direto;

  const alunoId = normalizeId(aluno.id);

  const responsavel = responsaveis.find((item) => normalizeId(item.alunoId) === alunoId);

  return normalizeText(responsavel?.nomeCompleto ?? responsavel?.nome) || "-";
}

function getTelefoneResponsavel(responsaveis: ApiResponsavel[], aluno: any): string {
  const direto = normalizeText(
    aluno.telefoneResponsavel ??
      aluno.telefone_responsavel ??
      aluno.whatsappResponsavel ??
      aluno.responsavel_whatsapp ??
      aluno.matricula?.responsavel?.whatsapp ??
      aluno.matricula?.responsavel?.telefone,
  );

  if (direto) return direto;

  const alunoId = normalizeId(aluno.id);

  const responsavel = responsaveis.find((item) => normalizeId(item.alunoId) === alunoId);

  return normalizeText(responsavel?.whatsapp ?? responsavel?.telefone);
}

function normalizeAluno(
  raw: any,
  planos: ApiPlano[],
  turmas: ApiTurma[],
  responsaveis: ApiResponsavel[],
): Aluno {
  const nome =
    normalizeText(raw.nome) ||
    normalizeText(raw.nome_completo) ||
    normalizeText(raw.nomeCompleto) ||
    "Aluno sem nome";

  const responsavel = getResponsavelNome(responsaveis, raw);

  const telefoneResponsavel = getTelefoneResponsavel(responsaveis, raw);

  return {
    ...raw,
    id: normalizeId(raw.id ?? raw.aluno_id ?? raw.codigo) || crypto.randomUUID(),

    nome,

    nomeCompleto: normalizeText(raw.nome_completo ?? raw.nomeCompleto ?? nome),

    email: normalizeText(
      raw.email ?? raw.emailContato ?? raw.email_contato ?? raw.responsavel_email,
    ),

    telefone: normalizeText(
      raw.telefone ?? raw.telefoneContato ?? raw.telefone_contato ?? raw.whatsapp,
    ),

    telefoneResponsavel,

    dataNascimento: normalizeText(raw.dataNascimento ?? raw.data_nascimento ?? raw.nascimento),

    modalidade: normalizeText(raw.modalidade ?? raw.modalidade_principal) || "-",

    turma: getTurmaNome(turmas, raw),

    plano: getPlanoNome(planos, raw),

    status: normalizeAlunoStatus(raw.status),

    responsavel,

    unidade: normalizeText(raw.unidade ?? raw.unidade_principal),

    numeroMatricula: normalizeText(
      raw.numeroMatricula ?? raw.numero_matricula ?? raw.matricula_numero,
    ),

    matriculaEm: normalizeText(raw.matriculaEm ?? raw.matricula_em ?? raw.created_at),

    raw,
  };
}

export async function getAlunos(): Promise<Aluno[]> {
  const [alunosResponse, planosResponse, turmasResponse, responsaveisResponse] = await Promise.all([
    apiGet<unknown>("/alunos"),
    apiGet<unknown>("/planos"),
    apiGet<unknown>("/turmas"),
    apiGet<unknown>("/responsaveis"),
  ]);

  const alunos = asArray<any>(alunosResponse);
  const planos = asArray<ApiPlano>(planosResponse);
  const turmas = asArray<ApiTurma>(turmasResponse);
  const responsaveis = asArray<ApiResponsavel>(responsaveisResponse);

  const normalized = alunos.map((aluno) => normalizeAluno(aluno, planos, turmas, responsaveis));

  return normalized;
}

export async function createAluno(aluno: Aluno): Promise<Aluno> {
  return apiSend<Aluno>("/alunos", "POST", aluno);
}

export async function updateAluno(aluno: Aluno): Promise<Aluno> {
  return apiSend<Aluno>(`/alunos/${aluno.id}`, "PUT", aluno);
}

export async function deleteAluno(id: string): Promise<void> {
  await apiSend<void>(`/alunos/${id}`, "DELETE");
}
