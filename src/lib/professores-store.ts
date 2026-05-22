import { useSyncExternalStore } from "react";
import type { Modalidade } from "./alunos-store";
import { api } from "./api";
import { createMysqlResourceStore } from "./mysql-resource-store";

export type StatusProfessor = "ativo" | "f\u00E9rias" | "inativo";
export type StatusContratoProfessor =
  | "N\u00E3o gerado"
  | "Pendente de assinatura"
  | "Assinado"
  | "Expirado";
export type FormaAssinaturaProfessor = "Canvas" | "Digitada" | "Aceite";
export type FormaPagamentoProfessor = "PIX" | "Conta banc\u00E1ria" | "Dinheiro" | "Boleto";

export type AssinaturaProfessor = {
  nomeAssinante: string;
  cpfAssinante: string;
  dataAssinatura: string;
  ipAssinatura?: string;
  formaAssinatura: FormaAssinaturaProfessor;
  representacaoAssinatura?: string;
};

export type ContratoProfessor = {
  numeroContrato: string;
  status: StatusContratoProfessor;
  dataGeracao: string;
  dataAssinatura: string;
  templateTitulo: string;
  conteudoHtml: string;
  assinatura: AssinaturaProfessor | null;
};

export type Professor = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  cref: string;
  modalidades: Modalidade[];
  unidades: string[];
  status: StatusProfessor;
  turmas: string[];
  jornadaProfessor: string;
  tipoContrato: string;
  valorContrato: number;
  formaPagamentoProfessor: FormaPagamentoProfessor;
  dataInicioContrato: string;
  observacoesContrato: string;
  contrato: ContratoProfessor;
  historicoContratos: ContratoProfessor[];
  criadoEm: string;
  atualizadoEm: string;
};

export type ProfessorInput = Omit<
  Professor,
  "id" | "contrato" | "historicoContratos" | "criadoEm" | "atualizadoEm"
>;

type LegacyProfessor = Partial<Professor> & {
  modalidade?: Modalidade;
  unidade?: string;
};

const STORAGE_KEY = "j12.professores.v1";

export const STATUS_PROFESSOR_OPTIONS: Array<{
  value: StatusProfessor;
  label: string;
}> = [
  { value: "ativo", label: "Ativo" },
  { value: "f\u00E9rias", label: "F\u00E9rias" },
  { value: "inativo", label: "Inativo" },
];

export const FORMA_PAGAMENTO_PROFESSOR_OPTIONS: FormaPagamentoProfessor[] = [
  "PIX",
  "Conta banc\u00E1ria",
  "Dinheiro",
  "Boleto",
];

export const TIPO_CONTRATO_OPTIONS = [
  "Presta\u00E7\u00E3o de servi\u00E7os",
  "CLT",
  "Pessoa jur\u00EDdica",
  "Contrato tempor\u00E1rio",
];

function nowIso() {
  return new Date().toISOString();
}

function todayIso() {
  return nowIso().slice(0, 10);
}

function nowPtBr() {
  return new Date().toLocaleString("pt-BR");
}

function formatDatePtBr(value: string) {
  if (!value) return "\u2014";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function randomIp() {
  return `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeModalidades(values: unknown, fallback?: unknown): Modalidade[] {
  const raw = Array.isArray(values) ? values : typeof fallback === "string" ? [fallback] : [];
  const normalized = dedupeStrings(raw.filter((item): item is string => typeof item === "string"));
  return normalized;
}

function normalizeUnidades(values: unknown, fallback?: unknown): string[] {
  const raw = Array.isArray(values) ? values : typeof fallback === "string" ? [fallback] : [];
  const normalized = dedupeStrings(raw.filter((item): item is string => typeof item === "string"));
  return normalized;
}

function createEmptyContract(): ContratoProfessor {
  return {
    numeroContrato: "",
    status: "N\u00E3o gerado",
    dataGeracao: "",
    dataAssinatura: "",
    templateTitulo: "CONTRATO DO PROFESSOR",
    conteudoHtml: "",
    assinatura: null,
  };
}

function createContractNumber() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  return `PRF-${yyyy}${mm}${dd}-${suffix}`;
}

export function getProfessorModalidadesLabel(professor: Pick<Professor, "modalidades">) {
  return professor.modalidades.join(", ");
}

export function getProfessorUnidadesLabel(professor: Pick<Professor, "unidades">) {
  return professor.unidades.join(", ");
}

export function professorHasModalidade(
  professor: Pick<Professor, "modalidades">,
  modalidade: Modalidade,
) {
  return professor.modalidades.includes(modalidade);
}

export function professorHasUnidade(professor: Pick<Professor, "unidades">, unidade: string) {
  return professor.unidades.includes(unidade);
}

export function professorCanHandleClass(
  professor: Pick<Professor, "modalidades" | "unidades">,
  turma: { modalidade: Modalidade; unidade: string },
) {
  return (
    professorHasModalidade(professor, turma.modalidade) &&
    professorHasUnidade(professor, turma.unidade)
  );
}

function createContractHtml(professor: Professor, numeroContrato: string) {
  const observacoes = professor.observacoesContrato.trim()
    ? `<p><strong>Observa\u00E7\u00F5es contratuais:</strong> ${escapeHtml(professor.observacoesContrato)}</p>`
    : "<p><strong>Observa\u00E7\u00F5es contratuais:</strong> Nenhuma observa\u00E7\u00E3o adicional registrada.</p>";

  return `
    <article style="font-family: Arial, sans-serif; color: #111827; line-height: 1.65;">
      <header style="border-bottom: 3px solid #ff6a00; padding-bottom: 18px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #ff6a00;">
          J12 Sports
        </p>
        <h1 style="margin: 0; font-size: 28px; color: #111827;">CONTRATO DO PROFESSOR</h1>
        <p style="margin: 12px 0 0; font-size: 14px; color: #4b5563;">
          N\u00FAmero do contrato: <strong>${escapeHtml(numeroContrato)}</strong> â€¢ Gerado em ${escapeHtml(nowPtBr())}
        </p>
      </header>

      <section style="margin-bottom: 18px;">
        <h2 style="font-size: 18px; margin-bottom: 8px; color: #111827;">1. Identifica\u00E7\u00E3o das partes</h2>
        <p>
          <strong>Contratante:</strong> J12 Sports, organiza\u00E7\u00E3o esportiva com atua\u00E7\u00E3o em forma\u00E7\u00E3o e desenvolvimento
          de atletas, doravante denominada J12.
        </p>
        <p>
          <strong>Contratado(a):</strong> ${escapeHtml(professor.nome)}, CPF ${escapeHtml(professor.cpf)}, CREF ${escapeHtml(professor.cref || "N\u00E3o informado")},
          e-mail ${escapeHtml(professor.email)} e telefone ${escapeHtml(professor.telefone)}.
        </p>
      </section>

      <section style="margin-bottom: 18px;">
        <h2 style="font-size: 18px; margin-bottom: 8px; color: #111827;">2. Fun\u00E7\u00E3o exercida</h2>
        <p>
          O(a) professor(a) atuar\u00E1 nas modalidades <strong>${escapeHtml(getProfessorModalidadesLabel(professor) || "A definir")}</strong>, nas unidades
          <strong> ${escapeHtml(getProfessorUnidadesLabel(professor) || "A definir")}</strong>, com jornada prevista de
          <strong> ${escapeHtml(professor.jornadaProfessor)}</strong>.
        </p>
      </section>

      <section style="margin-bottom: 18px;">
        <h2 style="font-size: 18px; margin-bottom: 8px; color: #111827;">3. Responsabilidades do professor</h2>
        <ul style="padding-left: 18px;">
          <li>Planejar, ministrar e acompanhar aulas e treinos dentro do padr\u00E3o t\u00E9cnico da J12.</li>
          <li>Manter comunica\u00E7\u00E3o profissional com coordena\u00E7\u00E3o, alunos e respons\u00E1veis.</li>
          <li>Zelar pela seguran\u00E7a, disciplina, pontualidade e organiza\u00E7\u00E3o das turmas sob sua responsabilidade.</li>
          <li>Registrar presen\u00E7a, ocorr\u00EAncias e informa\u00E7\u00F5es operacionais sempre que solicitado.</li>
        </ul>
      </section>

      <section style="margin-bottom: 18px;">
        <h2 style="font-size: 18px; margin-bottom: 8px; color: #111827;">4. Carga hor\u00E1ria, aulas e hor\u00E1rios</h2>
        <p>
          O presente contrato contempla a seguinte jornada base: <strong>${escapeHtml(professor.jornadaProfessor)}</strong>.
          As turmas inicialmente associadas s\u00E3o: <strong>${escapeHtml(professor.turmas.join(", ") || "A definir")}</strong>.
        </p>
      </section>

      <section style="margin-bottom: 18px;">
        <h2 style="font-size: 18px; margin-bottom: 8px; color: #111827;">5. Forma de contrata\u00E7\u00E3o e pagamento</h2>
        <p>
          Tipo de contrato: <strong>${escapeHtml(professor.tipoContrato)}</strong>. In\u00EDcio de vig\u00EAncia em
          <strong> ${escapeHtml(formatDatePtBr(professor.dataInicioContrato))}</strong>.
        </p>
        <p>
          Valor combinado: <strong>${professor.valorContrato.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>,
          com pagamento via <strong>${escapeHtml(professor.formaPagamentoProfessor)}</strong>.
        </p>
      </section>

      <section style="margin-bottom: 18px;">
        <h2 style="font-size: 18px; margin-bottom: 8px; color: #111827;">6. Regras de conduta</h2>
        <ul style="padding-left: 18px;">
          <li>\u00C9 obrigat\u00F3rio manter postura \u00E9tica, alinhada ao c\u00F3digo disciplinar e pedag\u00F3gico da J12.</li>
          <li>N\u00E3o \u00E9 permitido compartilhar dados sens\u00EDveis de alunos, respons\u00E1veis ou opera\u00E7\u00F5es internas sem autoriza\u00E7\u00E3o.</li>
          <li>\u00C9 vedado o uso indevido de imagem, marca, metodologia ou materiais da J12 fora do contexto autorizado.</li>
        </ul>
      </section>

      <section style="margin-bottom: 18px;">
        <h2 style="font-size: 18px; margin-bottom: 8px; color: #111827;">7. Documenta\u00E7\u00E3o e regularidade profissional</h2>
        <p>
          O(a) professor(a) declara manter documenta\u00E7\u00E3o civil e profissional regular, inclusive CREF ativo quando
          aplic\u00E1vel \u00E0 modalidade e atividade exercida.
        </p>
      </section>

      <section style="margin-bottom: 18px;">
        <h2 style="font-size: 18px; margin-bottom: 8px; color: #111827;">8. Vig\u00EAncia, renova\u00E7\u00E3o e encerramento</h2>
        <p>
          O contrato entra em vigor em ${escapeHtml(formatDatePtBr(professor.dataInicioContrato))} e permanece v\u00E1lido
          conforme as condi\u00E7\u00F5es estabelecidas entre as partes, podendo ser renovado, substitu\u00EDdo ou encerrado por novo
          instrumento formal, notifica\u00E7\u00E3o interna ou ajuste operacional registrado pela coordena\u00E7\u00E3o.
        </p>
      </section>

      <section style="margin-bottom: 18px;">
        <h2 style="font-size: 18px; margin-bottom: 8px; color: #111827;">9. Aceite eletr\u00F4nico</h2>
        <p>
          As partes concordam que este contrato poder\u00E1 ser firmado eletronicamente. O aceite digital, por desenho em
          canvas, assinatura digitada ou aceite simples, produz os mesmos efeitos jur\u00EDdicos da assinatura f\u00EDsica.
        </p>
      </section>

      <section style="margin-bottom: 18px;">
        <h2 style="font-size: 18px; margin-bottom: 8px; color: #111827;">10. Campo de assinatura</h2>
        <p>
          Professor(a): <strong>${escapeHtml(professor.nome)}</strong> â€¢ CPF <strong>${escapeHtml(professor.cpf)}</strong>
        </p>
        ${observacoes}
      </section>
    </article>
  `.trim();
}

function createGeneratedContract(
  professor: Professor,
  status: StatusContratoProfessor = "Pendente de assinatura",
  assinatura: AssinaturaProfessor | null = null,
) {
  const numeroContrato = createContractNumber();
  return {
    numeroContrato,
    status,
    dataGeracao: nowPtBr(),
    dataAssinatura: assinatura?.dataAssinatura ?? "",
    templateTitulo: "CONTRATO DO PROFESSOR",
    conteudoHtml: createContractHtml(professor, numeroContrato),
    assinatura,
  } satisfies ContratoProfessor;
}

function normalizeStatusProfessor(value: unknown): StatusProfessor {
  if (value === "f\u00E9rias" || value === "fÃƒÂ©rias" || value === "ferias") return "f\u00E9rias";
  if (value === "inativo") return "inativo";
  return "ativo";
}

function normalizeStatusContratoProfessor(value: unknown): StatusContratoProfessor {
  if (value === "Pendente de assinatura") return "Pendente de assinatura";
  if (value === "Assinado") return "Assinado";
  if (value === "Expirado") return "Expirado";
  return "N\u00E3o gerado";
}

function normalizeFormaPagamento(value: unknown): FormaPagamentoProfessor {
  if (
    value === "Conta banc\u00E1ria" ||
    value === "Conta bancÃƒÂ¡ria" ||
    value === "Conta bancaria"
  ) {
    return "Conta banc\u00E1ria";
  }
  if (value === "Dinheiro") return "Dinheiro";
  if (value === "Boleto") return "Boleto";
  return "PIX";
}

function normalizeProfessor(professor: LegacyProfessor): Professor {
  return {
    id: professor.id || `pr${Date.now()}`,
    nome: professor.nome || "",
    email: professor.email || "",
    telefone: professor.telefone || "",
    cpf: professor.cpf || "",
    cref: professor.cref || "",
    modalidades: normalizeModalidades(professor.modalidades, professor.modalidade),
    unidades: normalizeUnidades(professor.unidades, professor.unidade),
    status: normalizeStatusProfessor(professor.status),
    turmas: dedupeStrings(Array.isArray(professor.turmas) ? professor.turmas : []),
    jornadaProfessor: professor.jornadaProfessor || "",
    tipoContrato: professor.tipoContrato || TIPO_CONTRATO_OPTIONS[0],
    valorContrato: Number(professor.valorContrato || 0),
    formaPagamentoProfessor: normalizeFormaPagamento(professor.formaPagamentoProfessor),
    dataInicioContrato: professor.dataInicioContrato || todayIso(),
    observacoesContrato: professor.observacoesContrato || "",
    contrato: {
      ...createEmptyContract(),
      ...professor.contrato,
      status: normalizeStatusContratoProfessor(professor.contrato?.status),
    },
    historicoContratos: Array.isArray(professor.historicoContratos)
      ? professor.historicoContratos.map((contrato) => ({
          ...createEmptyContract(),
          ...contrato,
          status: normalizeStatusContratoProfessor(contrato.status),
        }))
      : [],
    criadoEm: professor.criadoEm || nowIso(),
    atualizadoEm: professor.atualizadoEm || nowIso(),
  };
}

function serializeProfessor(professor: Professor | ProfessorInput) {
  return {
    nome: professor.nome,
    email: professor.email,
    telefone: professor.telefone,
    cpf: professor.cpf,
    cref: professor.cref,
    modalidades: professor.modalidades,
    unidades: professor.unidades,
    status: professor.status,
    turmas: professor.turmas,
    jornadaProfessor: professor.jornadaProfessor,
    tipoContrato: professor.tipoContrato,
    valorContrato: professor.valorContrato,
    formaPagamentoProfessor: professor.formaPagamentoProfessor,
    dataInicioContrato: professor.dataInicioContrato,
    observacoesContrato: professor.observacoesContrato,
    contrato: "contrato" in professor ? professor.contrato : createEmptyContract(),
    historicoContratos: "historicoContratos" in professor ? professor.historicoContratos : [],
  };
}

function seedData() {
  const base: Professor[] = [
    {
      id: "pr1",
      nome: "Ricardo Mendes",
      email: "ricardo@j12.com",
      telefone: "(11) 98111-2233",
      cpf: "123.456.789-10",
      cref: "CREF 123456-G/SP",
      modalidades: ["Futebol", "Futsal"],
      unidades: ["Unidade Centro", "Unidade Zona Norte"],
      status: "ativo",
      turmas: ["Sub-11 Tarde", "Sub-9 Manh\u00E3"],
      jornadaProfessor: "Seg, Qua e Sex â€¢ 14:00 \u00E0s 18:00",
      tipoContrato: "Presta\u00E7\u00E3o de servi\u00E7os",
      valorContrato: 3200,
      formaPagamentoProfessor: "PIX",
      dataInicioContrato: "2026-01-10",
      observacoesContrato:
        "Professor respons\u00E1vel pelo n\u00FAcleo t\u00E9cnico de base e acompanhamento de avalia\u00E7\u00F5es.",
      contrato: createEmptyContract(),
      historicoContratos: [],
      criadoEm: nowIso(),
      atualizadoEm: nowIso(),
    },
    {
      id: "pr2",
      nome: "Camila Rocha",
      email: "camila@j12.com",
      telefone: "(11) 98222-3344",
      cpf: "234.567.890-11",
      cref: "CREF 654321-G/SP",
      modalidades: ["VÃ´lei", "NataÃ§Ã£o"],
      unidades: ["Unidade Centro"],
      status: "ativo",
      turmas: ["Sub-13 Tarde"],
      jornadaProfessor: "Ter e Qui â€¢ 15:00 \u00E0s 19:00",
      tipoContrato: "Pessoa jur\u00EDdica",
      valorContrato: 2800,
      formaPagamentoProfessor: "Conta banc\u00E1ria",
      dataInicioContrato: "2026-02-01",
      observacoesContrato:
        "Necess\u00E1rio envio de nota fiscal at\u00E9 o quinto dia \u00FAtil de cada m\u00EAs.",
      contrato: createEmptyContract(),
      historicoContratos: [],
      criadoEm: nowIso(),
      atualizadoEm: nowIso(),
    },
    {
      id: "pr3",
      nome: "Bruno Lima",
      email: "bruno@j12.com",
      telefone: "(11) 98333-4455",
      cpf: "345.678.901-22",
      cref: "CREF 998877-G/SP",
      modalidades: ["Basquete"],
      unidades: ["Unidade Centro"],
      status: "f\u00E9rias",
      turmas: ["Adulto Noite"],
      jornadaProfessor: "Ter e Qui â€¢ 19:00 \u00E0s 22:00",
      tipoContrato: "CLT",
      valorContrato: 4200,
      formaPagamentoProfessor: "Conta banc\u00E1ria",
      dataInicioContrato: "2025-08-15",
      observacoesContrato: "Professor com adicional por eventos e cl\u00EDnicas especiais.",
      contrato: createEmptyContract(),
      historicoContratos: [],
      criadoEm: nowIso(),
      atualizadoEm: nowIso(),
    },
    {
      id: "pr4",
      nome: "Andr\u00E9 Silva",
      email: "andre@j12.com",
      telefone: "(11) 98444-5566",
      cpf: "456.789.012-33",
      cref: "CREF 112233-G/SP",
      modalidades: ["Futsal"],
      unidades: ["Unidade Zona Sul"],
      status: "inativo",
      turmas: ["Sub-15 Noite"],
      jornadaProfessor: "Seg e Qua â€¢ 18:30 \u00E0s 21:30",
      tipoContrato: "Contrato tempor\u00E1rio",
      valorContrato: 2500,
      formaPagamentoProfessor: "Boleto",
      dataInicioContrato: "2025-03-01",
      observacoesContrato: "Contrato encerrado ao fim do ciclo competitivo de inverno.",
      contrato: createEmptyContract(),
      historicoContratos: [],
      criadoEm: nowIso(),
      atualizadoEm: nowIso(),
    },
  ];

  const signedSignature: AssinaturaProfessor = {
    nomeAssinante: "Ricardo Mendes",
    cpfAssinante: "123.456.789-10",
    dataAssinatura: new Date().toLocaleString("pt-BR"),
    ipAssinatura: "189.22.14.8",
    formaAssinatura: "Digitada",
    representacaoAssinatura: "Ricardo Mendes",
  };

  base[0].contrato = createGeneratedContract(base[0], "Assinado", signedSignature);
  base[1].contrato = createGeneratedContract(base[1], "Pendente de assinatura");
  base[3].contrato = {
    ...createGeneratedContract(base[3], "Expirado"),
    dataGeracao: "15/12/2025 09:30:00",
  };

  return base.map(normalizeProfessor);
}

const professoresResource = createMysqlResourceStore<Professor>({
  endpoint: "/professores",
  initialState: [],
  normalize: normalizeProfessor,
  loadAll: () => api.get<Professor[]>("/professores"),
  createEntity: (entity) => api.post<Professor>("/professores", serializeProfessor(entity)),
  updateEntity: (entity) =>
    api.put<Professor>(`/professores/${entity.id}`, serializeProfessor(entity)),
  deleteEntity: (id) => api.del(`/professores/${id}`),
});
let state: Professor[] = professoresResource.getSnapshot().map(normalizeProfessor);
const listeners = new Set<() => void>();

professoresResource.subscribe(() => {
  state = professoresResource.getSnapshot().map(normalizeProfessor);
  listeners.forEach((listener) => listener());
});

function emit() {
  professoresResource.replaceState(state.map(normalizeProfessor));
}

function replaceById(targetId: string, nextProfessor: Professor) {
  state = state.map((professor) =>
    professor.id === targetId ? normalizeProfessor(nextProfessor) : professor,
  );
  emit();
}

async function reloadProfessores() {
  await professoresResource.reload();
}

function persistProfessor(professor: Professor) {
  void api.put<Professor>(`/professores/${professor.id}`, serializeProfessor(professor)).then(
    (saved) => replaceById(professor.id, normalizeProfessor(saved as LegacyProfessor)),
    async (error) => {
      console.error("[professores-store] Falha ao salvar professor.", error);
      await reloadProfessores();
    },
  );
}

function hasGeneratedContract(contract: ContratoProfessor) {
  return contract.status !== "N\u00E3o gerado" && Boolean(contract.numeroContrato);
}

export const professoresStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return state;
  },
  reload() {
    return professoresResource.reload();
  },
  getById(id: string) {
    return state.find((professor) => professor.id === id);
  },
  create(data: ProfessorInput) {
    const optimisticId = `tmp-professor-${Date.now()}`;
    const novo: Professor = normalizeProfessor({
      ...data,
      id: optimisticId,
      contrato: createEmptyContract(),
      historicoContratos: [],
      criadoEm: nowIso(),
      atualizadoEm: nowIso(),
    });

    state = [novo, ...state];
    emit();

    void api
      .post<Professor>("/professores", serializeProfessor(novo))
      .then((saved) => {
        const normalized = normalizeProfessor(saved as LegacyProfessor);
        state = state.map((professor) => (professor.id === optimisticId ? normalized : professor));
        emit();
      })
      .catch(async (error) => {
        console.error("[professores-store] Falha ao criar professor.", error);
        await reloadProfessores();
      });

    return novo;
  },
  update(id: string, data: ProfessorInput) {
    state = state.map((professor) =>
      professor.id === id
        ? normalizeProfessor({
            ...professor,
            ...data,
            atualizadoEm: nowIso(),
          })
        : professor,
    );

    emit();
    const updated = state.find((professor) => professor.id === id);
    if (updated) {
      persistProfessor(updated);
    }
  },
  remove(id: string) {
    state = state.filter((professor) => professor.id !== id);
    emit();
    void api.del(`/professores/${id}`).catch(async (error) => {
      console.error("[professores-store] Falha ao remover professor.", error);
      await reloadProfessores();
    });
  },
  generateContract(id: string) {
    let generated: ContratoProfessor | null = null;

    state = state.map((professor) => {
      if (professor.id !== id) return professor;

      const historicoContratos = hasGeneratedContract(professor.contrato)
        ? [professor.contrato, ...professor.historicoContratos]
        : professor.historicoContratos;

      const atualizadoBase = {
        ...professor,
        historicoContratos,
      };

      generated = createGeneratedContract(atualizadoBase);

      return {
        ...atualizadoBase,
        contrato: generated,
        atualizadoEm: nowIso(),
      };
    });

    emit();
    const updated = state.find((professor) => professor.id === id);
    if (updated) {
      persistProfessor(updated);
    }
    return generated;
  },
  signContract(
    id: string,
    assinatura: Omit<AssinaturaProfessor, "dataAssinatura" | "ipAssinatura">,
  ) {
    let result: { ok: true; contrato: ContratoProfessor } | { ok: false; reason: string } = {
      ok: false,
      reason: "Professor n\u00E3o encontrado.",
    };

    state = state.map((professor) => {
      if (professor.id !== id) return professor;

      if (professor.contrato.status === "N\u00E3o gerado") {
        result = { ok: false, reason: "Gere o contrato antes de assinar." };
        return professor;
      }

      if (professor.contrato.status === "Assinado") {
        result = {
          ok: false,
          reason:
            "Este contrato j\u00E1 foi assinado. Gere um novo contrato para alterar o aceite.",
        };
        return professor;
      }

      if (professor.contrato.status === "Expirado") {
        result = {
          ok: false,
          reason: "Este contrato expirou. Gere um novo contrato antes de assinar.",
        };
        return professor;
      }

      const dataAssinatura = nowPtBr();
      const contratoAtualizado: ContratoProfessor = {
        ...professor.contrato,
        status: "Assinado",
        dataAssinatura,
        assinatura: {
          ...assinatura,
          dataAssinatura,
          ipAssinatura: randomIp(),
        },
      };

      result = { ok: true, contrato: contratoAtualizado };

      return {
        ...professor,
        contrato: contratoAtualizado,
        atualizadoEm: nowIso(),
      };
    });

    emit();
    const updated = state.find((professor) => professor.id === id);
    if (updated && result.ok) {
      persistProfessor(updated);
    }
    return result;
  },
};

export function useProfessores() {
  return useSyncExternalStore(
    professoresStore.subscribe,
    professoresStore.getSnapshot,
    professoresStore.getSnapshot,
  );
}

export function useProfessoresStatus() {
  return useSyncExternalStore(
    professoresStore.subscribe,
    professoresResource.getMeta,
    professoresResource.getMeta,
  );
}

export function statusProfessorBadgeClass(status: StatusProfessor) {
  switch (status) {
    case "ativo":
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
    case "f\u00E9rias":
      return "border-amber-400/30 bg-amber-500/15 text-amber-300";
    default:
      return "border-slate-500/30 bg-slate-500/15 text-slate-300";
  }
}

export function contratoProfessorBadgeClass(status: StatusContratoProfessor) {
  switch (status) {
    case "Assinado":
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
    case "Pendente de assinatura":
      return "border-amber-400/30 bg-amber-500/15 text-amber-300";
    case "Expirado":
      return "border-red-400/30 bg-red-500/15 text-red-300";
    default:
      return "border-slate-500/30 bg-slate-500/15 text-slate-300";
  }
}

export function getProfessorInitials(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function nextProfessorPaymentDate(_: Professor) {
  const base = new Date();
  const next = new Date(base.getFullYear(), base.getMonth(), 5);

  if (base.getDate() > 5) {
    next.setMonth(next.getMonth() + 1);
  }

  return next.toLocaleDateString("pt-BR");
}

export function downloadProfessorContract(professor: Professor) {
  if (typeof window === "undefined" || professor.contrato.status === "N\u00E3o gerado") return;

  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(professor.contrato.templateTitulo)} - ${escapeHtml(professor.nome)}</title>
        <style>
          body { font-family: Arial, sans-serif; background: #111827; color: #e5e7eb; margin: 0; padding: 32px; }
          .shell { max-width: 980px; margin: 0 auto; background: #0f172a; border: 1px solid rgba(255,106,0,.35); border-radius: 20px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #ff6a00, #ff8a00); color: #111827; padding: 24px 28px; }
          .content { padding: 28px; background: white; color: #111827; }
          .meta { font-size: 14px; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="shell">
          <div class="header">
            <div style="font-size:12px; letter-spacing:.16em; text-transform:uppercase; font-weight:700;">J12 Sports</div>
            <h1 style="margin:8px 0 0;">${escapeHtml(professor.contrato.templateTitulo)}</h1>
            <div class="meta">Contrato ${escapeHtml(professor.contrato.numeroContrato)} â€¢ ${escapeHtml(professor.nome)}</div>
          </div>
          <div class="content">
            ${professor.contrato.conteudoHtml}
          </div>
        </div>
      </body>
    </html>
  `.trim();

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `contrato_professor_${slugify(professor.nome)}_${professor.id}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

export function resetProfessoresStore() {
  state = [];
  emit();
}

export function createProfessorContractPreview(professor: Professor) {
  return createContractHtml(professor, professor.contrato.numeroContrato || createContractNumber());
}

export { todayIso };
