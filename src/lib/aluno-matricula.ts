export type AlunoDocumentKey =
  | "fotoPerfilAluno"
  | "rgCpfAluno"
  | "rgCpfResponsavel"
  | "comprovanteEndereco"
  | "atestadoMedico";

export type AlunoDocumentStatus = "pendencia_documental" | "documentacao_completa";

export interface AlunoUploadedDocument {
  name: string;
  size: number;
  type: string;
  uploadedAt?: string;
  expiresAt?: string | null;
}

export interface AlunoDadosPessoais {
  numeroMatricula: string;
  nomeCompleto: string;
  dataNascimento: string;
  idade: string;
  cpf: string;
  rg: string;
  sexo: string;
  colegio: string;
  periodoEscolar: string;
}

export interface AlunoResponsavelInfo {
  nomeCompleto: string;
  cpf: string;
  rg: string;
  whatsapp: string;
  email: string;
  parentesco: string;
}

export interface AlunoEnderecoInfo {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface AlunoDocumentosInfo {
  fotoPerfilAluno: AlunoUploadedDocument | null;
  rgCpfAluno: AlunoUploadedDocument | null;
  rgCpfResponsavel: AlunoUploadedDocument | null;
  comprovanteEndereco: AlunoUploadedDocument | null;
  atestadoMedico: AlunoUploadedDocument | null;
}

export interface AlunoEsportivasInfo {
  modalidades: string[];
  unidades: string[];
  horarios: string[];
  turmas: string[];
  nivel: string;
  treinouAntes: string;
  caracteristica: string;
  objetivo: string;
}

export interface AlunoSaudeInfo {
  restricaoMedica: string;
  medicamentos: string;
  alergias: string;
  lesoes: string;
  planoSaude: string;
  observacoesImportantes: string;
}

export interface AlunoEstrategicasInfo {
  comoConheceu: string;
  indicacaoQuem: string;
  observacoesGerais: string;
}

export interface AlunoMatriculaData {
  dadosAluno: AlunoDadosPessoais;
  responsavel: AlunoResponsavelInfo;
  endereco: AlunoEnderecoInfo;
  documentos: AlunoDocumentosInfo;
  esportivas: AlunoEsportivasInfo;
  saude: AlunoSaudeInfo;
  estrategicas: AlunoEstrategicasInfo;
}

export const ALUNO_DOCUMENT_LABELS: Record<AlunoDocumentKey, string> = {
  fotoPerfilAluno: "Foto de perfil do aluno",
  rgCpfAluno: "RG com CPF do aluno",
  rgCpfResponsavel: "RG com CPF do responsável",
  comprovanteEndereco: "Comprovante de endereço",
  atestadoMedico: "Atestado médico",
};

function uniqueValues(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDocument(value: unknown): AlunoUploadedDocument | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<AlunoUploadedDocument>;
  const name = text(candidate.name);
  if (!name) return null;

  return {
    name,
    size: typeof candidate.size === "number" ? candidate.size : 0,
    type: text(candidate.type),
    uploadedAt: text(candidate.uploadedAt) || undefined,
    expiresAt: text(candidate.expiresAt) || null,
  };
}

export function calculateStudentAge(dateValue: string): string {
  if (!dateValue) return "";
  const birthDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return String(Math.max(age, 0));
}

export function buildEmptyAlunoMatricula(): AlunoMatriculaData {
  return {
    dadosAluno: {
      numeroMatricula: "",
      nomeCompleto: "",
      dataNascimento: "",
      idade: "",
      cpf: "",
      rg: "",
      sexo: "",
      colegio: "",
      periodoEscolar: "",
    },
    responsavel: {
      nomeCompleto: "",
      cpf: "",
      rg: "",
      whatsapp: "",
      email: "",
      parentesco: "",
    },
    endereco: {
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
    },
    documentos: {
      fotoPerfilAluno: null,
      rgCpfAluno: null,
      rgCpfResponsavel: null,
      comprovanteEndereco: null,
      atestadoMedico: null,
    },
    esportivas: {
      modalidades: [],
      unidades: [],
      horarios: [],
      turmas: [],
      nivel: "",
      treinouAntes: "",
      caracteristica: "",
      objetivo: "",
    },
    saude: {
      restricaoMedica: "",
      medicamentos: "",
      alergias: "",
      lesoes: "",
      planoSaude: "",
      observacoesImportantes: "",
    },
    estrategicas: {
      comoConheceu: "",
      indicacaoQuem: "",
      observacoesGerais: "",
    },
  };
}

export function normalizeAlunoMatriculaData(
  value: Partial<AlunoMatriculaData> | null | undefined,
): AlunoMatriculaData {
  const base = buildEmptyAlunoMatricula();

  return {
    dadosAluno: {
      ...base.dadosAluno,
      ...value?.dadosAluno,
      numeroMatricula: text(value?.dadosAluno?.numeroMatricula),
      nomeCompleto: text(value?.dadosAluno?.nomeCompleto),
      dataNascimento: text(value?.dadosAluno?.dataNascimento),
      idade: text(value?.dadosAluno?.idade),
      cpf: text(value?.dadosAluno?.cpf),
      rg: text(value?.dadosAluno?.rg),
      sexo: text(value?.dadosAluno?.sexo),
      colegio: text(value?.dadosAluno?.colegio),
      periodoEscolar: text(value?.dadosAluno?.periodoEscolar),
    },
    responsavel: {
      ...base.responsavel,
      ...value?.responsavel,
      nomeCompleto: text(value?.responsavel?.nomeCompleto),
      cpf: text(value?.responsavel?.cpf),
      rg: text(value?.responsavel?.rg),
      whatsapp: text(value?.responsavel?.whatsapp),
      email: text(value?.responsavel?.email),
      parentesco: text(value?.responsavel?.parentesco),
    },
    endereco: {
      ...base.endereco,
      ...value?.endereco,
      cep: text(value?.endereco?.cep),
      rua: text(value?.endereco?.rua),
      numero: text(value?.endereco?.numero),
      complemento: text(value?.endereco?.complemento),
      bairro: text(value?.endereco?.bairro),
      cidade: text(value?.endereco?.cidade),
      estado: text(value?.endereco?.estado),
    },
    documentos: {
      fotoPerfilAluno: normalizeDocument(value?.documentos?.fotoPerfilAluno),
      rgCpfAluno: normalizeDocument(value?.documentos?.rgCpfAluno),
      rgCpfResponsavel: normalizeDocument(value?.documentos?.rgCpfResponsavel),
      comprovanteEndereco: normalizeDocument(value?.documentos?.comprovanteEndereco),
      atestadoMedico: normalizeDocument(value?.documentos?.atestadoMedico),
    },
    esportivas: {
      ...base.esportivas,
      ...value?.esportivas,
      modalidades: uniqueValues(value?.esportivas?.modalidades),
      unidades: uniqueValues(value?.esportivas?.unidades),
      horarios: uniqueValues(value?.esportivas?.horarios),
      turmas: uniqueValues(value?.esportivas?.turmas),
      nivel: text(value?.esportivas?.nivel),
      treinouAntes: text(value?.esportivas?.treinouAntes),
      caracteristica: text(value?.esportivas?.caracteristica),
      objetivo: text(value?.esportivas?.objetivo),
    },
    saude: {
      ...base.saude,
      ...value?.saude,
      restricaoMedica: text(value?.saude?.restricaoMedica),
      medicamentos: text(value?.saude?.medicamentos),
      alergias: text(value?.saude?.alergias),
      lesoes: text(value?.saude?.lesoes),
      planoSaude: text(value?.saude?.planoSaude),
      observacoesImportantes: text(value?.saude?.observacoesImportantes),
    },
    estrategicas: {
      ...base.estrategicas,
      ...value?.estrategicas,
      comoConheceu: text(value?.estrategicas?.comoConheceu),
      indicacaoQuem: text(value?.estrategicas?.indicacaoQuem),
      observacoesGerais: text(value?.estrategicas?.observacoesGerais),
    },
  };
}

function hasDocument(document: AlunoUploadedDocument | null) {
  return Boolean(document?.name);
}

function getDocumentExpiry(document: AlunoUploadedDocument | null) {
  if (!document?.expiresAt) return null;
  const expiry = new Date(`${document.expiresAt}T23:59:59`);
  return Number.isNaN(expiry.getTime()) ? null : expiry;
}

export function isMedicalDocumentExpired(document: AlunoUploadedDocument | null) {
  const expiry = getDocumentExpiry(document);
  if (!expiry) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expiry < today;
}

export function isMedicalDocumentValidityInvalid(document: AlunoUploadedDocument | null) {
  const expiry = getDocumentExpiry(document);
  if (!expiry) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxExpiry = new Date(today);
  maxExpiry.setFullYear(maxExpiry.getFullYear() + 1);

  return expiry > maxExpiry;
}

export function getAlunoDocumentPendencies(
  matricula: Partial<AlunoMatriculaData> | null | undefined,
): string[] {
  const documentos = normalizeAlunoMatriculaData(matricula).documentos;
  const pendencies: string[] = [];

  if (hasDocument(documentos.atestadoMedico) && documentos.atestadoMedico.expiresAt) {
    if (isMedicalDocumentExpired(documentos.atestadoMedico)) {
      pendencies.push("Atestado médico vencido");
    } else if (isMedicalDocumentValidityInvalid(documentos.atestadoMedico)) {
      pendencies.push("Validade do atestado médico acima de 1 ano");
    }
  }

  return pendencies;
}

export function getAlunoDocumentStatus(
  matricula: Partial<AlunoMatriculaData> | null | undefined,
): AlunoDocumentStatus {
  return getAlunoDocumentPendencies(matricula).length === 0
    ? "documentacao_completa"
    : "pendencia_documental";
}

export function getAlunoDocumentStatusLabel(status: AlunoDocumentStatus) {
  return status === "documentacao_completa" ? "Documentação completa" : "Pendência documental";
}
