import { useSyncExternalStore } from "react";
import {
  alunosStore,
  formatAlunoScope,
  getAlunoModalidades,
  getAlunoPlanos,
  getAlunoTurmas,
  getAlunoUnidades,
  type Aluno,
} from "./alunos-store";
import { createMysqlResourceStore } from "./mysql-resource-store";
import { mysqlApi } from "./mysql-api";
import { planosStore, type Plano } from "./planos-store";

export type StatusCobranca = "pago" | "pendente" | "vencido" | "cancelada" | "isenta" | "parcial";
export type TipoCobranca = "mensalidade" | "matricula" | "uniforme" | "evento" | "outros";
export type PeriodicidadeCobranca = "mensal" | "bimestral" | "trimestral" | "semestral" | "anual";
export type TipoLancamento = "recorrente" | "avulsa";

export interface Transacao {
  id: string;
  alunoId: string;
  alunoNome: string;
  descricao: string;
  tipo: TipoCobranca;
  valor: number;
  vencimento: string;
  pagoEm: string | null;
  formaPagamento?: "pix" | "cartao" | "dinheiro" | "boleto";
  observacao?: string;
  responsavelFinanceiro?: string;
  responsavelCpf?: string;
  telefoneWhatsapp?: string;
  email?: string;
  unidade?: string;
  modalidade?: string;
  turma?: string;
  planoId?: string | null;
  planoNome?: string;
  plano_nome?: string;
  periodicidade?: PeriodicidadeCobranca;
  competencia?: string;
  valorOriginal?: number;
  descontoValor?: number;
  descontoPercentual?: number;
  bolsaValor?: number;
  bolsaPercentual?: number;
  multaPercentual?: number;
  jurosDiaPercentual?: number;
  valorFinal?: number;
  dataGeracao?: string;
  dataPagamento?: string | null;
  status?: StatusCobranca;
  tipoCobranca?: TipoLancamento;
  origem?: "automatica" | "manual";
  ativo?: boolean;
  alteradoEm?: string | null;
  alteradoPor?: string | null;
  cancelamentoMotivo?: string | null;
  descontoMotivo?: string | null;
}

export interface RecorrenciaFinanceiraAluno {
  alunoId: string;
  alunoNome: string;
  planoId: string | null;
  planoNome: string;
  recorrenciaAtiva: boolean;
  periodicidade: PeriodicidadeCobranca;
  diaVencimento: number;
  dataInicio: string;
  dataFim?: string | null;
  proximaCobranca: string | null;
  descontoValor: number;
  descontoPercentual: number;
  bolsaValor: number;
  bolsaPercentual: number;
  multaPercentual: number;
  jurosDiaPercentual: number;
  cobrancaAutomatica: boolean;
  cobrancaProporcional: boolean;
  valorPlano: number;
  observacoes?: string | null;
  unidade?: string;
  modalidade?: string;
  turma?: string;
  statusAluno?: Aluno["status"];
  ultimaGeracaoEm?: string | null;
}

type GerarMensalidadesResponse = {
  competencia: string;
  createdCount: number;
  skippedCount: number;
  message: string;
};

type TransacaoInput = Omit<Transacao, "id" | "alunoNome" | "valor" | "pagoEm"> & {
  alunoNome?: string;
  pagoEm?: string | null;
  valor?: number;
};
let latestFinanceSnapshot: Transacao[] = [];

const PERIODICIDADE_MONTHS: Record<PeriodicidadeCobranca, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeCurrency(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function sanitizeDay(value: unknown, fallback = 10) {
  const day = Number(value ?? fallback);
  if (!Number.isFinite(day)) return fallback;
  return Math.min(28, Math.max(1, Math.trunc(day)));
}

function firstDayOfMonth(iso: string) {
  const [year, month] = iso.slice(0, 7).split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function dateToISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function ensureDueDate(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

function inferPeriodicidade(name?: string | null): PeriodicidadeCobranca {
  const normalized = (name ?? "").toLowerCase();
  if (normalized.includes("bimes")) return "bimestral";
  if (normalized.includes("trimes")) return "trimestral";
  if (normalized.includes("semes")) return "semestral";
  if (normalized.includes("anual")) return "anual";
  return "mensal";
}

function normalizeTransacao(transacao: Transacao): Transacao {
  const valorOriginal = sanitizeCurrency(
    transacao.valorOriginal ?? transacao.valorFinal ?? transacao.valor,
  );
  const valorFinal = sanitizeCurrency(transacao.valorFinal ?? transacao.valor);

  return {
    ...transacao,
    valorOriginal,
    descontoValor: sanitizeCurrency(transacao.descontoValor),
    descontoPercentual: sanitizeCurrency(transacao.descontoPercentual),
    bolsaValor: sanitizeCurrency(transacao.bolsaValor),
    bolsaPercentual: sanitizeCurrency(transacao.bolsaPercentual),
    multaPercentual: sanitizeCurrency(transacao.multaPercentual),
    jurosDiaPercentual: sanitizeCurrency(transacao.jurosDiaPercentual),
    valorFinal,
    valor: valorFinal,
    pagoEm: transacao.pagoEm ?? null,
    dataPagamento: transacao.dataPagamento ?? transacao.pagoEm ?? null,
    competencia:
      transacao.competencia ??
      `${(transacao.vencimento || todayISO()).slice(0, 7)}:${transacao.periodicidade ?? "mensal"}`,
    dataGeracao: transacao.dataGeracao ?? todayISO(),
    tipoCobranca:
      transacao.tipoCobranca ?? (transacao.tipo === "mensalidade" ? "recorrente" : "avulsa"),
    origem: transacao.origem ?? "manual",
    ativo: transacao.ativo ?? true,
    planoId: transacao.planoId ?? null,
    planoNome: transacao.planoNome ?? transacao.descricao.replace(/^Mensalidade - /i, ""),
  };
}

function monthOffset(months: number, day = 10) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return dateToISO(ensureDueDate(date.getFullYear(), date.getMonth(), day));
}

function resolvePlanoFinanceiro(aluno: Aluno): {
  planoId: string | null;
  planoNome: string;
  valorPlano: number;
  periodicidade: PeriodicidadeCobranca;
} {
  try {
    const alunoPlanName =
      aluno?.plano_nome ||
      aluno?.planoNome ||
      aluno?.plano ||
      getAlunoPlanos(aluno)?.[0] ||
      "Plano não informado";

    let matchedPlano: Plano | null = null;

    if (aluno?.plano_id) {
      matchedPlano = planosStore.getById(String(aluno.plano_id));
    }

    if (!matchedPlano && aluno?.planoId) {
      matchedPlano = planosStore.getById(String(aluno.planoId));
    }

    if (!matchedPlano) {
      matchedPlano =
        planosStore.getSnapshot().find((plano) => String(plano.nome) === String(alunoPlanName)) ??
        null;
    }

    const existingCharge = latestFinanceSnapshot.find(
      (transacao) =>
        transacao.alunoId === aluno.id &&
        transacao.tipo === "mensalidade" &&
        transacao.ativo !== false &&
        calcStatus(transacao) !== "cancelada",
    );

    const planoId =
      aluno?.financeiro?.planoId ?? aluno?.plano_id ?? aluno?.planoId ?? matchedPlano?.id ?? null;

    const planoNome = matchedPlano?.nome ?? aluno?.plano_nome ?? aluno?.planoNome ?? alunoPlanName;

    const valorPlano =
      sanitizeCurrency(aluno?.financeiro?.valorPlano) ||
      sanitizeCurrency(matchedPlano?.valor) ||
      sanitizeCurrency(matchedPlano?.precoMensal) ||
      sanitizeCurrency(aluno?.plano_valor) ||
      sanitizeCurrency(aluno?.planoValor) ||
      sanitizeCurrency(aluno?.mensalidade) ||
      sanitizeCurrency(
        existingCharge?.valorOriginal ?? existingCharge?.valorFinal ?? existingCharge?.valor ?? 0,
      );

    const periodicidade =
      aluno?.financeiro?.periodicidade ??
      inferPeriodicidade(matchedPlano?.frequencia ?? matchedPlano?.nome ?? alunoPlanName);

    return {
      planoId: planoId ? String(planoId) : null,
      planoNome,
      valorPlano,
      periodicidade,
    };
  } catch (error) {
    console.warn("[financeiro-store] Falha ao resolver plano do aluno:", error);

    return {
      planoId: aluno?.plano_id || aluno?.planoId ? String(aluno?.plano_id ?? aluno?.planoId) : null,
      planoNome: aluno?.plano_nome || aluno?.planoNome || aluno?.plano || "Plano não informado",
      valorPlano: sanitizeCurrency(
        aluno?.plano_valor || aluno?.planoValor || aluno?.mensalidade || 0,
      ),
      periodicidade: "mensal",
    };
  }
}

function buildCompetencia(start: Date, periodicidade: PeriodicidadeCobranca) {
  return `${dateToISO(start).slice(0, 7)}:${periodicidade}`;
}

function listCompetenciasAte(recurrence: RecorrenciaFinanceiraAluno, referenceDate = todayISO()) {
  const start = firstDayOfMonth(recurrence.dataInicio);
  const end = firstDayOfMonth(referenceDate);
  const output: Array<{ competencia: string; inicio: string; vencimento: string }> = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const inicio = new Date(cursor);
    output.push({
      competencia: buildCompetencia(inicio, recurrence.periodicidade),
      inicio: dateToISO(inicio),
      vencimento: dateToISO(
        ensureDueDate(inicio.getFullYear(), inicio.getMonth(), recurrence.diaVencimento),
      ),
    });
    cursor.setMonth(cursor.getMonth() + PERIODICIDADE_MONTHS[recurrence.periodicidade]);
  }

  return output;
}

function computeProRataAmount(value: number, startDate: string) {
  const [year, month, day] = startDate.split("-").map(Number);
  if (!year || !month || !day) return value;
  const daysInMonth = new Date(year, month, 0).getDate();
  const remainingDays = Math.max(1, daysInMonth - day + 1);
  return sanitizeCurrency((value / daysInMonth) * remainingDays);
}

function computeBaseAmount(
  recurrence: RecorrenciaFinanceiraAluno,
  competenceStart: string,
  studentStartDate: string,
) {
  if (
    recurrence.cobrancaProporcional &&
    competenceStart.slice(0, 7) === studentStartDate.slice(0, 7) &&
    studentStartDate.slice(8, 10) !== "01"
  ) {
    return computeProRataAmount(recurrence.valorPlano, studentStartDate);
  }

  return recurrence.valorPlano;
}

function computeChargeValues(
  recurrence: RecorrenciaFinanceiraAluno,
  competenceStart: string,
  studentStartDate: string,
) {
  const valorOriginal = sanitizeCurrency(
    computeBaseAmount(recurrence, competenceStart, studentStartDate),
  );
  const descontoPercentual = sanitizeCurrency(recurrence.descontoPercentual);
  const descontoValor = sanitizeCurrency(
    recurrence.descontoValor + valorOriginal * (descontoPercentual / 100),
  );
  const bolsaPercentual = sanitizeCurrency(recurrence.bolsaPercentual);
  const bolsaValor = sanitizeCurrency(
    recurrence.bolsaValor + valorOriginal * (bolsaPercentual / 100),
  );
  const valorFinal = Math.max(0, sanitizeCurrency(valorOriginal - descontoValor - bolsaValor));

  return {
    valorOriginal,
    descontoPercentual,
    descontoValor,
    bolsaPercentual,
    bolsaValor,
    valorFinal,
  };
}

function buildRecorrenciaFromAluno(aluno: Aluno): RecorrenciaFinanceiraAluno | null {
  const plano = resolvePlanoFinanceiro(aluno);
  if (!plano.planoNome) return null;

  return {
    alunoId: aluno.id,
    alunoNome: aluno.nome,
    planoId: plano.planoId,
    planoNome: plano.planoNome,
    recorrenciaAtiva:
      aluno.financeiro?.recorrenciaAtiva ?? aluno.financeiro?.cobrancaAutomatica ?? true,
    periodicidade: plano.periodicidade,
    diaVencimento: sanitizeDay(
      aluno.financeiro?.diaVencimento ?? aluno.matriculaEm.slice(8, 10) ?? 10,
    ),
    dataInicio: aluno.financeiro?.dataInicioFinanceiro ?? aluno.matriculaEm ?? todayISO(),
    dataFim: null,
    proximaCobranca: null,
    descontoValor: sanitizeCurrency(aluno.financeiro?.descontoValor),
    descontoPercentual: sanitizeCurrency(aluno.financeiro?.descontoPercentual),
    bolsaValor: sanitizeCurrency(aluno.financeiro?.bolsaValor),
    bolsaPercentual: sanitizeCurrency(aluno.financeiro?.bolsaPercentual),
    multaPercentual: sanitizeCurrency(aluno.financeiro?.multaPercentual),
    jurosDiaPercentual: sanitizeCurrency(aluno.financeiro?.jurosDiaPercentual),
    cobrancaAutomatica: aluno.financeiro?.cobrancaAutomatica ?? true,
    cobrancaProporcional: aluno.financeiro?.cobrancaProporcional ?? false,
    valorPlano: plano.valorPlano,
    observacoes: aluno.financeiro?.observacoes ?? null,
    unidade: getAlunoUnidades(aluno)[0] ?? "",
    modalidade: getAlunoModalidades(aluno)[0] ?? aluno.modalidade,
    turma: getAlunoTurmas(aluno)[0] ?? aluno.turma,
    statusAluno: aluno.status,
    ultimaGeracaoEm: null,
  };
}

function computeNextChargeDate(
  recurrence: RecorrenciaFinanceiraAluno,
  transacoes: Transacao[],
  referenceDate = todayISO(),
) {
  const competencias = listCompetenciasAte(recurrence, referenceDate);

  for (const competencia of competencias) {
    const exists = transacoes.some(
      (transacao) =>
        transacao.alunoId === recurrence.alunoId &&
        transacao.tipoCobranca === "recorrente" &&
        transacao.competencia === competencia.competencia &&
        calcStatus(transacao) !== "cancelada",
    );
    if (!exists) return competencia.vencimento;
  }

  const next = firstDayOfMonth(referenceDate);
  next.setMonth(next.getMonth() + PERIODICIDADE_MONTHS[recurrence.periodicidade]);
  return dateToISO(ensureDueDate(next.getFullYear(), next.getMonth(), recurrence.diaVencimento));
}

function syncRecorrencias(transacoes: Transacao[], previous: RecorrenciaFinanceiraAluno[] = []) {
  const previousByAluno = new Map(previous.map((item) => [item.alunoId, item]));
  const next: RecorrenciaFinanceiraAluno[] = [];

  for (const aluno of alunosStore.getSnapshot()) {
    const base = buildRecorrenciaFromAluno(aluno);
    if (!base) continue;

    const previousItem = previousByAluno.get(aluno.id);
    const merged: RecorrenciaFinanceiraAluno = {
      ...base,
      ...previousItem,
      alunoId: aluno.id,
      alunoNome: aluno.nome,
      planoId: base.planoId,
      planoNome: base.planoNome,
      valorPlano: base.valorPlano,
      periodicidade: base.periodicidade,
      statusAluno: aluno.status,
      unidade: base.unidade,
      modalidade: base.modalidade,
      turma: base.turma,
      dataInicio: previousItem?.dataInicio || base.dataInicio,
      recorrenciaAtiva: previousItem?.recorrenciaAtiva ?? base.recorrenciaAtiva,
      cobrancaAutomatica: previousItem?.cobrancaAutomatica ?? base.cobrancaAutomatica,
      proximaCobranca: null,
    };

    merged.proximaCobranca = computeNextChargeDate(merged, transacoes);
    next.push(merged);
  }

  return next;
}

const seed: Transacao[] = (() => {
  const alunos = alunosStore.getSnapshot();
  if (alunos.length === 0) return [];

  const output: Transacao[] = [];
  let counter = 0;

  for (const aluno of alunos.slice(0, 4)) {
    const plano = resolvePlanoFinanceiro(aluno);
    const recorrencia = buildRecorrenciaFromAluno(aluno);
    const valor = plano.valorPlano || 280;

    output.push(
      normalizeTransacao({
        id: `f${++counter}`,
        alunoId: aluno.id,
        alunoNome: aluno.nome,
        descricao: `Mensalidade - ${formatAlunoScope(getAlunoPlanos(aluno))}`,
        tipo: "mensalidade",
        valor,
        vencimento: monthOffset(-1, recorrencia?.diaVencimento ?? 10),
        pagoEm: monthOffset(-1, 8),
        formaPagamento: "pix",
        planoId: plano.planoId,
        planoNome: plano.planoNome,
        periodicidade: plano.periodicidade,
        competencia: `${monthOffset(-1).slice(0, 7)}:${plano.periodicidade}`,
        valorOriginal: valor,
        valorFinal: valor,
        origem: "automatica",
        tipoCobranca: "recorrente",
      }),
    );
  }

  return output;
})();

const financeiroResource = createMysqlResourceStore<Transacao>({
  endpoint: "/financeiro",
  initialState: [],
  normalize: normalizeTransacao,
});

let transacoesState: Transacao[] = financeiroResource.getSnapshot().map(normalizeTransacao);
latestFinanceSnapshot = transacoesState;
let recorrenciasState: RecorrenciaFinanceiraAluno[] = syncRecorrencias(transacoesState);
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

financeiroResource.subscribe(() => {
  transacoesState = financeiroResource.getSnapshot().map(normalizeTransacao);
  latestFinanceSnapshot = transacoesState;
  recorrenciasState = syncRecorrencias(transacoesState, recorrenciasState);
  emit();
});

alunosStore.subscribe(() => {
  recorrenciasState = syncRecorrencias(transacoesState, recorrenciasState);
  emit();
});

function replaceTransacoes(nextState: Transacao[]) {
  transacoesState = nextState.map(normalizeTransacao);
  latestFinanceSnapshot = transacoesState;
  recorrenciasState = syncRecorrencias(transacoesState, recorrenciasState);
  financeiroResource.replaceState(transacoesState);
}

function buildChargeFromInput(data: TransacaoInput, current?: Transacao): Transacao {
  const aluno = alunosStore.getById(data.alunoId);
  const valorOriginal = sanitizeCurrency(
    data.valorOriginal ?? data.valor ?? current?.valorOriginal,
  );
  const descontoValor = sanitizeCurrency(data.descontoValor ?? current?.descontoValor);
  const descontoPercentual = sanitizeCurrency(
    data.descontoPercentual ?? current?.descontoPercentual,
  );
  const bolsaValor = sanitizeCurrency(data.bolsaValor ?? current?.bolsaValor);
  const bolsaPercentual = sanitizeCurrency(data.bolsaPercentual ?? current?.bolsaPercentual);
  const periodicidade =
    data.periodicidade ?? current?.periodicidade ?? inferPeriodicidade(data.planoNome);
  const valorFinal = Math.max(
    0,
    sanitizeCurrency(
      data.valorFinal ??
        current?.valorFinal ??
        valorOriginal -
          descontoValor -
          valorOriginal * (descontoPercentual / 100) -
          bolsaValor -
          valorOriginal * (bolsaPercentual / 100),
    ),
  );
  const planoNome =
    data.planoNome ?? current?.planoNome ?? (aluno ? resolvePlanoFinanceiro(aluno).planoNome : "");

  return normalizeTransacao({
    ...(current ?? {}),
    ...data,
    id: current?.id ?? `f${Date.now()}`,
    alunoNome: data.alunoNome ?? aluno?.nome ?? current?.alunoNome ?? "-",
    valor: valorFinal,
    valorOriginal,
    descontoValor,
    descontoPercentual,
    bolsaValor,
    bolsaPercentual,
    valorFinal,
    pagoEm: data.pagoEm ?? current?.pagoEm ?? null,
    dataPagamento: data.pagoEm ?? current?.dataPagamento ?? null,
    planoNome,
    periodicidade,
    competencia:
      data.competencia ?? current?.competencia ?? `${data.vencimento.slice(0, 7)}:${periodicidade}`,
    dataGeracao: data.dataGeracao ?? current?.dataGeracao ?? todayISO(),
    responsavelFinanceiro:
      data.responsavelFinanceiro ??
      current?.responsavelFinanceiro ??
      aluno?.matricula?.responsavel.nomeCompleto ??
      aluno?.responsavel ??
      aluno?.nome,
    responsavelCpf:
      data.responsavelCpf ?? current?.responsavelCpf ?? aluno?.matricula?.responsavel.cpf ?? "",
    telefoneWhatsapp:
      data.telefoneWhatsapp ??
      current?.telefoneWhatsapp ??
      aluno?.matricula?.responsavel.whatsapp ??
      aluno?.telefoneResponsavel ??
      aluno?.telefone,
    email:
      data.email ?? current?.email ?? aluno?.matricula?.responsavel.email ?? aluno?.email ?? "",
    unidade: data.unidade ?? current?.unidade ?? (aluno ? getAlunoUnidades(aluno)[0] : ""),
    modalidade:
      data.modalidade ?? current?.modalidade ?? (aluno ? getAlunoModalidades(aluno)[0] : ""),
    turma: data.turma ?? current?.turma ?? (aluno ? getAlunoTurmas(aluno)[0] : ""),
    tipoCobranca: data.tipoCobranca ?? current?.tipoCobranca ?? "avulsa",
    origem: data.origem ?? current?.origem ?? "manual",
    ativo: data.ativo ?? current?.ativo ?? true,
    status: data.status ?? current?.status ?? (data.pagoEm || current?.pagoEm ? "pago" : undefined),
  });
}

function isDuplicateCharge(
  transacoes: Transacao[],
  candidate: Pick<Transacao, "alunoId" | "competencia" | "tipoCobranca">,
  excludeId?: string,
) {
  return transacoes.some((transacao) => {
    if (excludeId && transacao.id === excludeId) return false;
    if (transacao.alunoId !== candidate.alunoId) return false;
    if (transacao.competencia !== candidate.competencia) return false;
    if ((transacao.tipoCobranca ?? "avulsa") !== candidate.tipoCobranca) return false;
    return calcStatus(transacao) !== "cancelada";
  });
}

export function calcStatus(transacao: Transacao): StatusCobranca {
  if (
    transacao.status === "cancelada" ||
    transacao.status === "isenta" ||
    transacao.status === "parcial"
  ) {
    return transacao.status;
  }
  if (transacao.pagoEm) return "pago";
  return transacao.vencimento < todayISO() ? "vencido" : "pendente";
}

export function getValorAtualizado(transacao: Transacao, referenceDate = todayISO()) {
  const status = calcStatus(transacao);
  const base = sanitizeCurrency(transacao.valorFinal ?? transacao.valor);
  if (status !== "vencido") return base;

  const vencimento = new Date(`${transacao.vencimento}T00:00:00`);
  const referencia = new Date(`${referenceDate}T00:00:00`);
  const diff = Math.max(
    0,
    Math.floor((referencia.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const multa = base * ((transacao.multaPercentual ?? 0) / 100);
  const juros = base * ((transacao.jurosDiaPercentual ?? 0) / 100) * diff;
  return sanitizeCurrency(base + multa + juros);
}

export function getRecorrenciaAluno(alunoId: string) {
  return recorrenciasState.find((recorrencia) => recorrencia.alunoId === alunoId) ?? null;
}

export const financeiroStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return transacoesState;
  },
  getRecorrenciasSnapshot() {
    return recorrenciasState;
  },
  async processarRecorrenciaAutomatica(referenceDate = todayISO()) {
    const result = await mysqlApi.post<GerarMensalidadesResponse>(
      "/financeiro/gerar-mensalidades",
      {
        referencia: referenceDate.slice(0, 7),
      },
    );
    await financeiroResource.reload();
    return result;
  },
  create(data: TransacaoInput) {
    const novaTransacao = buildChargeFromInput(data);
    if (
      novaTransacao.tipoCobranca === "recorrente" &&
      isDuplicateCharge(transacoesState, {
        alunoId: novaTransacao.alunoId,
        competencia: novaTransacao.competencia ?? "",
        tipoCobranca: "recorrente",
      })
    ) {
      throw new Error("Ja existe uma cobranca recorrente para este aluno nessa competencia.");
    }

    replaceTransacoes([novaTransacao, ...transacoesState]);
    financeiroResource.persistCreate(novaTransacao);
    return novaTransacao;
  },
  update(id: string, data: Partial<Transacao>) {
    const current = transacoesState.find((transacao) => transacao.id === id);
    if (!current) return null;

    const next = buildChargeFromInput(
      {
        ...current,
        ...data,
        alunoId: data.alunoId ?? current.alunoId,
        tipo: data.tipo ?? current.tipo,
        descricao: data.descricao ?? current.descricao,
        vencimento: data.vencimento ?? current.vencimento,
      },
      current,
    );

    if (
      next.tipoCobranca === "recorrente" &&
      isDuplicateCharge(
        transacoesState,
        {
          alunoId: next.alunoId,
          competencia: next.competencia ?? "",
          tipoCobranca: "recorrente",
        },
        id,
      )
    ) {
      throw new Error("Ja existe uma cobranca recorrente para este aluno nessa competencia.");
    }

    replaceTransacoes(transacoesState.map((transacao) => (transacao.id === id ? next : transacao)));
    financeiroResource.persistUpdate(next);
    return next;
  },
  remove(id: string) {
    replaceTransacoes(transacoesState.filter((transacao) => transacao.id !== id));
    financeiroResource.persistDelete(id);
  },
  baixar(id: string, forma: NonNullable<Transacao["formaPagamento"]>) {
    const updated = transacoesState.find((transacao) => transacao.id === id);
    if (!updated) return;
    const next = normalizeTransacao({
      ...updated,
      pagoEm: todayISO(),
      dataPagamento: todayISO(),
      formaPagamento: forma,
      status: "pago",
    });
    replaceTransacoes(transacoesState.map((transacao) => (transacao.id === id ? next : transacao)));
    financeiroResource.persistUpdate(next);
  },
  reabrir(id: string) {
    const updated = transacoesState.find((transacao) => transacao.id === id);
    if (!updated) return;
    const next = normalizeTransacao({
      ...updated,
      pagoEm: null,
      dataPagamento: null,
      formaPagamento: undefined,
      status: "pendente",
    });
    replaceTransacoes(transacoesState.map((transacao) => (transacao.id === id ? next : transacao)));
    financeiroResource.persistUpdate(next);
  },
  cancelar(id: string, motivo = "Cancelada manualmente") {
    const updated = transacoesState.find((transacao) => transacao.id === id);
    if (!updated) return;
    const next = normalizeTransacao({
      ...updated,
      status: "cancelada",
      cancelamentoMotivo: motivo,
      ativo: false,
    });
    replaceTransacoes(transacoesState.map((transacao) => (transacao.id === id ? next : transacao)));
    financeiroResource.persistUpdate(next);
  },
  baixarLote(ids: string[], forma: NonNullable<Transacao["formaPagamento"]>) {
    const selectedIds = new Set(ids);
    let count = 0;
    const changed: Transacao[] = [];
    const nextState = transacoesState.map((transacao) => {
      if (selectedIds.has(transacao.id) && calcStatus(transacao) !== "pago") {
        count += 1;
        const next = normalizeTransacao({
          ...transacao,
          pagoEm: todayISO(),
          dataPagamento: todayISO(),
          formaPagamento: forma,
          status: "pago",
        });
        changed.push(next);
        return next;
      }
      return transacao;
    });

    replaceTransacoes(nextState);
    changed.forEach((transacao) => financeiroResource.persistUpdate(transacao));
    return count;
  },
  pausarRecorrencia(alunoId: string) {
    const aluno = alunosStore.getById(alunoId);
    if (!aluno) return;
    alunosStore.update(alunoId, {
      financeiro: {
        ...(aluno.financeiro ?? {}),
        recorrenciaAtiva: false,
        cobrancaAutomatica: false,
      },
    });
  },
  reativarRecorrencia(alunoId: string) {
    const aluno = alunosStore.getById(alunoId);
    if (!aluno) return;
    alunosStore.update(alunoId, {
      financeiro: {
        ...(aluno.financeiro ?? {}),
        recorrenciaAtiva: true,
        cobrancaAutomatica: true,
      },
    });
  },
  cancelarFuturas(alunoId: string) {
    const today = todayISO();
    const changed: Transacao[] = [];
    const nextState = transacoesState.map((transacao) => {
      if (
        transacao.alunoId === alunoId &&
        transacao.tipoCobranca === "recorrente" &&
        transacao.vencimento >= today &&
        calcStatus(transacao) !== "pago"
      ) {
        const next = normalizeTransacao({
          ...transacao,
          status: "cancelada",
          ativo: false,
          cancelamentoMotivo: "Recorrencia pausada",
        });
        changed.push(next);
        return next;
      }

      return transacao;
    });

    replaceTransacoes(nextState);
    changed.forEach((transacao) => financeiroResource.persistUpdate(transacao));
  },
};

export function useTransacoes(): Transacao[] {
  return useSyncExternalStore(
    financeiroStore.subscribe,
    financeiroStore.getSnapshot,
    financeiroStore.getSnapshot,
  );
}

export function useRecorrenciasFinanceiras(): RecorrenciaFinanceiraAluno[] {
  return useSyncExternalStore(
    financeiroStore.subscribe,
    financeiroStore.getRecorrenciasSnapshot,
    financeiroStore.getRecorrenciasSnapshot,
  );
}

export function useFinanceiroStatus() {
  return useSyncExternalStore(
    financeiroStore.subscribe,
    financeiroResource.getMeta,
    financeiroResource.getMeta,
  );
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function monthLabel(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function listMonths(transacoes: Transacao[]): string[] {
  const months = new Set<string>();
  transacoes.forEach((transacao) => months.add(transacao.vencimento.slice(0, 7)));
  months.add(new Date().toISOString().slice(0, 7));
  return Array.from(months).sort().reverse();
}
