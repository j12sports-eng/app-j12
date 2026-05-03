import { useSyncExternalStore } from "react";
import {
  alunosStore,
  formatAlunoScope,
  getAlunoPlanos,
  getAlunoTurmas,
  type Aluno,
} from "./alunos-store";
import { financeiroStore } from "./financeiro-store";
import { createRemoteCollectionStore } from "./remote-collection";
import {
  CONTRATO_TEMPLATE_J12,
  formatBRDate,
  formatBRDateLong,
  renderTemplate,
  type ContratoVariaveis,
} from "./contratos-template";

export type StatusContrato =
  | "rascunho"
  | "aguardando_assinatura"
  | "ativo"
  | "encerrado"
  | "cancelado";

export interface AssinaturaEletronica {
  nome: string;
  cpf: string;
  ip: string;
  dispositivo: string;
  assinadoEm: string; // ISO datetime
}

export interface Contrato {
  id: string;
  alunoId: string;
  alunoNome: string;
  /** Dados do responsável usados no contrato (snapshot na criação) */
  responsavel: ContratoVariaveis["responsavel"];
  plano: ContratoPlano;
  /** Valores financeiros */
  valorTotal: number;
  parcelas: number;
  valorMensal: number;
  diaVencimento: number;
  /** Vigência */
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  /** Conteúdo final renderizado (com variáveis substituÃ­das) */
  conteudo: string;
  status: StatusContrato;
  assinatura: AssinaturaEletronica | null;
  assinaturaJ12: AssinaturaEletronica | null;
  /** IDs das transações geradas no Financeiro a partir deste contrato */
  transacoesGeradas: string[];
  criadoEm: string; // ISO datetime
}

/** Plano contratado — aceita múltiplas modalidades e unidades. */
export interface ContratoPlano {
  tipo: string;
  modalidades: string[];
  frequencia: string;
  horario: string;
  unidades: string[];
}

export interface ContratoInput {
  alunoId: string;
  responsavel: ContratoVariaveis["responsavel"];
  plano: ContratoPlano;
  valorTotal: number;
  parcelas: number;
  diaVencimento: number;
  dataInicio: string;
  dataFim: string;
}

function nowISO() {
  return new Date().toISOString();
}

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Junta lista com vírgula + “e” para texto natural. */
function joinList(list: string[]): string {
  const arr = list.filter(Boolean);
  if (arr.length === 0) return "—";
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} e ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")} e ${arr[arr.length - 1]}`;
}

/** Monta o objeto de variáveis a partir de um contrato. */
export function buildVariaveis(
  c: ContratoInput,
  alunoNome: string,
  alunoNasc: string,
): ContratoVariaveis {
  const valorMensal = c.parcelas > 0 ? c.valorTotal / c.parcelas : c.valorTotal;
  return {
    responsavel: c.responsavel,
    aluno: {
      nome: alunoNome,
      data_nascimento: formatBRDate(alunoNasc),
    },
    plano: {
      tipo: c.plano.tipo,
      modalidade: joinList(c.plano.modalidades),
      frequencia: c.plano.frequencia,
      horario: c.plano.horario,
      unidade: joinList(c.plano.unidades),
    },
    financeiro: {
      valor_total: brl(c.valorTotal),
      parcelas: String(c.parcelas),
      valor_mensal: brl(valorMensal),
      vencimento: String(c.diaVencimento).padStart(2, "0"),
    },
    contrato: {
      data_inicio: formatBRDate(c.dataInicio),
      data_fim: formatBRDate(c.dataFim),
      data_assinatura: formatBRDateLong(new Date().toISOString().slice(0, 10)),
    },
  };
}

function defaultsFromAluno(a: Aluno): {
  responsavel: ContratoVariaveis["responsavel"];
  plano: ContratoPlano;
} {
  const isMenor = (() => {
    const d = new Date(a.dataNascimento);
    const idade = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return idade < 18;
  })();
  return {
    responsavel: {
      nome: isMenor ? (a.responsavel ?? a.nome) : a.nome,
      cpf: "",
      telefone: isMenor ? (a.telefoneResponsavel ?? a.telefone) : a.telefone,
      email: a.email,
      endereco: "",
    },
    plano: {
      tipo: getAlunoPlanos(a)[0] ?? a.plano,
      modalidades: [a.modalidade === "Futebol" ? "Society" : a.modalidade],
      frequencia: "2x por semana",
      horario: formatAlunoScope(getAlunoTurmas(a)),
      unidades: ["Pirituba — SP"],
    },
  };
}

/** Cria um rascunho a partir do aluno selecionado, sem persistir ainda. */
export function draftFromAluno(alunoId: string): ContratoInput | null {
  const a = alunosStore.getById(alunoId);
  if (!a) return null;
  const { responsavel, plano } = defaultsFromAluno(a);
  const hoje = new Date();
  const inicio = hoje.toISOString().slice(0, 10);
  const fimD = new Date(hoje);
  fimD.setMonth(fimD.getMonth() + 12);
  return {
    alunoId,
    responsavel,
    plano,
    valorTotal: 1800,
    parcelas: 12,
    diaVencimento: 10,
    dataInicio: inicio,
    dataFim: fimD.toISOString().slice(0, 10),
  };
}

function seed(): Contrato[] {
  const alunos = alunosStore.getSnapshot().slice(0, 3);
  const out: Contrato[] = [];
  alunos.forEach((a, i) => {
    const draft = draftFromAluno(a.id);
    if (!draft) return;
    const vars = buildVariaveis(draft, a.nome, a.dataNascimento);
    const valorMensal = draft.valorTotal / draft.parcelas;
    out.push({
      id: `c${i + 1}`,
      alunoId: a.id,
      alunoNome: a.nome,
      responsavel: draft.responsavel,
      plano: draft.plano,
      valorTotal: draft.valorTotal,
      parcelas: draft.parcelas,
      valorMensal,
      diaVencimento: draft.diaVencimento,
      dataInicio: draft.dataInicio,
      dataFim: draft.dataFim,
      conteudo: renderTemplate(CONTRATO_TEMPLATE_J12, vars),
      status: i === 0 ? "ativo" : i === 1 ? "aguardando_assinatura" : "rascunho",
      assinatura:
        i === 0
          ? {
              nome: draft.responsavel.nome,
              cpf: draft.responsavel.cpf || "—",
              ip: "189.45.12.10",
              dispositivo: "Chrome / macOS",
              assinadoEm: nowISO(),
            }
          : null,
      assinaturaJ12:
        i === 0
          ? {
              nome: "Anderson Silva — Diretor J12",
              cpf: "28.665.452/0001-01",
              ip: "10.0.0.1",
              dispositivo: "Sistema J12",
              assinadoEm: nowISO(),
            }
          : null,
      transacoesGeradas: [],
      criadoEm: nowISO(),
    });
  });
  return out;
}

const contratosCollection = createRemoteCollectionStore<Contrato[]>("contratos", [], {
  emptyState: [],
});
let state: Contrato[] = contratosCollection.getSnapshot();
const listeners = new Set<() => void>();

contratosCollection.subscribe(() => {
  state = contratosCollection.getSnapshot();
  listeners.forEach((listener) => listener());
});

const emit = () => contratosCollection.replaceState(state);

export const contratosStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot() {
    return state;
  },
  reload() {
    return contratosCollection.reload();
  },
  getById(id: string) {
    return state.find((c) => c.id === id);
  },
  getByAluno(alunoId: string) {
    return state.filter((c) => c.alunoId === alunoId);
  },
  create(input: ContratoInput, conteudoEditado?: string): Contrato {
    const a = alunosStore.getById(input.alunoId);
    const nome = a?.nome ?? "—";
    const vars = buildVariaveis(input, nome, a?.dataNascimento ?? "");
    const conteudo = conteudoEditado ?? renderTemplate(CONTRATO_TEMPLATE_J12, vars);
    const novo: Contrato = {
      id: `c${Date.now()}`,
      alunoId: input.alunoId,
      alunoNome: nome,
      responsavel: input.responsavel,
      plano: input.plano,
      valorTotal: input.valorTotal,
      parcelas: input.parcelas,
      valorMensal: input.parcelas > 0 ? input.valorTotal / input.parcelas : input.valorTotal,
      diaVencimento: input.diaVencimento,
      dataInicio: input.dataInicio,
      dataFim: input.dataFim,
      conteudo,
      status: "rascunho",
      assinatura: null,
      assinaturaJ12: null,
      transacoesGeradas: [],
      criadoEm: nowISO(),
    };
    state = [novo, ...state];
    emit();
    return novo;
  },
  update(id: string, input: ContratoInput, conteudoEditado?: string) {
    const a = alunosStore.getById(input.alunoId);
    const nome = a?.nome ?? "—";
    const vars = buildVariaveis(input, nome, a?.dataNascimento ?? "");
    const conteudo = conteudoEditado ?? renderTemplate(CONTRATO_TEMPLATE_J12, vars);
    state = state.map((c) =>
      c.id === id
        ? {
            ...c,
            ...input,
            alunoNome: nome,
            valorMensal: input.parcelas > 0 ? input.valorTotal / input.parcelas : input.valorTotal,
            conteudo,
          }
        : c,
    );
    emit();
  },
  remove(id: string) {
    state = state.filter((c) => c.id !== id);
    emit();
  },
  duplicate(id: string): Contrato | null {
    const orig = state.find((c) => c.id === id);
    if (!orig) return null;
    const novo: Contrato = {
      ...orig,
      id: `c${Date.now()}`,
      status: "rascunho",
      assinatura: null,
      assinaturaJ12: null,
      transacoesGeradas: [],
      criadoEm: nowISO(),
    };
    state = [novo, ...state];
    emit();
    return novo;
  },
  enviarParaAssinatura(id: string) {
    state = state.map((c) =>
      c.id === id && (c.status === "rascunho" || c.status === "ativo")
        ? { ...c, status: "aguardando_assinatura" }
        : c,
    );
    emit();
  },
  /** Assina como responsável (CONTRATANTE) ou como J12 (CONTRATADA). */
  assinar(
    id: string,
    dados: { nome: string; cpf: string },
    parte: "responsavel" | "j12" = "responsavel",
  ): { contrato: Contrato | null; parcelasGeradas: number } {
    const ip = `${Math.floor(Math.random() * 200) + 50}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const dispositivo =
      typeof navigator !== "undefined"
        ? (navigator.userAgent.split(")")[0].split("(")[1] ?? "Web")
        : "Web";
    const novaAssinatura: AssinaturaEletronica = {
      nome: dados.nome,
      cpf: dados.cpf,
      ip,
      dispositivo,
      assinadoEm: nowISO(),
    };

    let contratoFinal: Contrato | null = null;
    state = state.map((c): Contrato => {
      if (c.id !== id) return c;
      const updated: Contrato = {
        ...c,
        assinatura: parte === "responsavel" ? novaAssinatura : c.assinatura,
        assinaturaJ12: parte === "j12" ? novaAssinatura : c.assinaturaJ12,
      };
      // Quando ambas as partes assinaram, ativa o contrato
      if (updated.assinatura && updated.assinaturaJ12) {
        updated.status = "ativo";
      } else if (updated.status === "rascunho") {
        updated.status = "aguardando_assinatura";
      }
      contratoFinal = updated;
      return updated;
    });
    emit();

    // Geração automÃ¡tica de parcelas: somente quando ATIVOU pela primeira vez
    let parcelasGeradas = 0;
    const cf = contratoFinal as Contrato | null;
    if (cf && cf.status === "ativo" && cf.transacoesGeradas.length === 0) {
      parcelasGeradas = gerarParcelasFinanceiras(cf);
    }
    return { contrato: cf, parcelasGeradas };
  },
  cancelar(id: string) {
    const c = state.find((x) => x.id === id);
    state = state.map((x) => (x.id === id ? { ...x, status: "cancelado" } : x));
    // Cancela cobranças pendentes geradas pelo contrato
    if (c) {
      c.transacoesGeradas.forEach((tid) => {
        const t = financeiroStore.getSnapshot().find((tr) => tr.id === tid && !tr.pagoEm);
        if (t) financeiroStore.remove(tid);
      });
    }
    emit();
  },
};

/**
 * Gera N parcelas mensais no Financeiro a partir de um contrato ATIVO.
 * Vincula os IDs das transações ao contrato (transacoesGeradas).
 */
function gerarParcelasFinanceiras(c: Contrato): number {
  const ids: string[] = [];
  const inicio = new Date(c.dataInicio + "T00:00:00");
  const dia = c.diaVencimento;
  const modalidadesTxt = c.plano.modalidades.join(" + ");
  for (let i = 0; i < c.parcelas; i++) {
    const venc = new Date(inicio.getFullYear(), inicio.getMonth() + i, dia);
    const vencISO = venc.toISOString().slice(0, 10);
    const t = financeiroStore.create({
      alunoId: c.alunoId,
      descricao: `Mensalidade ${i + 1}/${c.parcelas} — ${modalidadesTxt} (Contrato ${c.id})`,
      tipo: "mensalidade",
      valor: c.valorMensal,
      vencimento: vencISO,
    });
    ids.push(t.id);
  }
  // Atualiza contrato com IDs gerados
  state = state.map((x) => (x.id === c.id ? { ...x, transacoesGeradas: ids } : x));
  emit();
  return ids.length;
}

export function useContratos(): Contrato[] {
  return useSyncExternalStore(
    contratosStore.subscribe,
    contratosStore.getSnapshot,
    contratosStore.getSnapshot,
  );
}

export function useContratosStatus() {
  return useSyncExternalStore(
    contratosStore.subscribe,
    contratosCollection.getMeta,
    contratosCollection.getMeta,
  );
}

export const STATUS_LABEL: Record<StatusContrato, string> = {
  rascunho: "Rascunho",
  aguardando_assinatura: "Aguardando assinatura",
  ativo: "Ativo",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};
