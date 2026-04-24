import { branding } from "@/lib/branding";
import type {
  AppearanceSettingsData,
  ContractSettingsData,
  ContractTemplateSetting,
  GeneralSettingsData,
  IntegrationSettingsData,
  ModalityItem,
  NotificationSettingsData,
  PermissionRule,
  SettingsState,
  TeacherAssetSetting,
} from "../types";
import { unitsMock } from "./unitsMock";
import { usersMock } from "./usersMock";

const now = new Date().toISOString();

export const generalSettingsMock: GeneralSettingsData = {
  companyName: "J12 Sports",
  cnpj: "12.345.678/0001-90",
  phone: "(11) 4000-9000",
  whatsapp: "(11) 99999-0000",
  email: "contato@j12sports.com.br",
  address: "Av. J12 Sports, 1200 - Sao Paulo/SP",
  logoDataUrl: branding.logo,
  slogan: "Alta performance com experiencia premium.",
};

export const appearanceSettingsMock: AppearanceSettingsData = {
  mode: "dark",
  headerColor: "#05070d",
  footerColor: "#05070d",
  menuColor: "#111111",
  menuBackgroundColor: "#000000",
  pageBackgroundColor: "#060b14",
  primaryColor: "#FF6B00",
  secondaryColor: "#121212",
  buttonColor: "#FF6B00",
  menuTextColor: "#F8FAFC",
  headerTextColor: "#F8FAFC",
  cardColor: "#111827",
  textColor: "#F8FAFC",
};

export const permissionsMock: PermissionRule[] = [
  {
    role: "admin",
    accessLevel: "total",
    profileScope: "global",
    canViewSelfOnly: false,
    canEditSelfOnly: false,
  },
  {
    role: "coordenador",
    accessLevel: "gestao",
    profileScope: "operacional",
    canViewSelfOnly: false,
    canEditSelfOnly: false,
  },
  {
    role: "professor",
    accessLevel: "restrito",
    profileScope: "turmas_vinculadas",
    canViewSelfOnly: false,
    canEditSelfOnly: false,
  },
  {
    role: "aluno",
    accessLevel: "self_service",
    profileScope: "proprio_perfil",
    canViewSelfOnly: true,
    canEditSelfOnly: true,
  },
];

export const modalitiesMock: ModalityItem[] = [
  {
    id: "mod-1",
    nome: "Futebol",
    descricao: "Treinos tecnicos, desenvolvimento motor e competicoes internas.",
    destaque: "#FF6B00",
    ativa: true,
  },
  {
    id: "mod-2",
    nome: "Futsal",
    descricao: "Aulas intensivas com foco em tomada de decisao e velocidade.",
    destaque: "#F97316",
    ativa: true,
  },
  {
    id: "mod-3",
    nome: "Volei",
    descricao: "Formacao de base, fundamentos e rotina competitiva.",
    destaque: "#FB923C",
    ativa: true,
  },
  {
    id: "mod-4",
    nome: "Society",
    descricao: "Treinos recreativos e grupos de alta frequencia.",
    destaque: "#EA580C",
    ativa: false,
  },
];

export const contractsMock: ContractTemplateSetting[] = [
  {
    id: "contract-1",
    nome: "Contrato aluno premium",
    titulo: "CONTRATO DE PRESTACAO DE SERVICOS ESPORTIVOS",
    conteudo:
      "Aluno: {{aluno.nome}}\nPlano: {{plano}}\nModalidade: {{modalidade}}\n\nAs partes concordam com o aceite eletronico e com as regras operacionais da J12 Sports.",
    ativo: true,
    documentType: "contrato_principal",
    updatedAt: now,
  },
  {
    id: "contract-2",
    nome: "Aditivo padrao de matricula",
    titulo: "ADITIVO DE CONTRATO",
    conteudo:
      "Aluno: {{aluno.nome}}\nPlano: {{plano}}\n\nEste aditivo complementa o contrato principal e registra alteracoes operacionais e financeiras.",
    ativo: true,
    documentType: "aditivo_contrato",
    updatedAt: now,
  },
  {
    id: "contract-3",
    nome: "Direito de uso de imagem",
    titulo: "TERMO DE AUTORIZACAO DE USO DE IMAGEM",
    conteudo:
      "Aluno: {{aluno.nome}}\nResponsavel: {{responsavel.nome}}\n\nAutorizacao para uso institucional de imagem em comunicacao da J12 Sports.",
    ativo: true,
    documentType: "direito_uso_imagem",
    updatedAt: now,
  },
];

export const contractSettingsMock: ContractSettingsData = {
  enableContract: true,
  enableContractAddendum: true,
  enableImageRights: true,
  defaultContractTemplate: "contract-1",
  defaultAddendumTemplate: "contract-2",
  defaultImageRightsTemplate: "contract-3",
};

export const notificationsMock: NotificationSettingsData = {
  lessonReminder: true,
  billing: true,
  absence: true,
  whatsappEnabled: true,
  emailEnabled: true,
  birthdayReminderEnabled: true,
  birthdayReminderType: "today",
  birthdayReminderMessage:
    "Hoje e dia de celebrar {{aluno.nome}}. Envie uma mensagem especial em nome da J12 Sports.",
  birthdayReminderDaysBefore: 3,
  birthdayReminderChannel: "dashboard",
};

export const integrationsMock: IntegrationSettingsData = {
  bankProvider: "Inter / Pix",
  pixKey: "financeiro@j12sports.com.br",
  apiKey: "sk_live_j12_demo_key",
  webhookUrl: "https://api.j12sports.com.br/webhooks/financeiro",
  automationToken: "auto_j12_token_demo",
};

export const teacherAssetsMock: TeacherAssetSetting[] = [
  {
    teacherId: "pr1",
    crefFileName: "cref_ricardo_mendes.pdf",
    contractFileName: "contrato_professor_ricardo.pdf",
  },
];

export const settingsMock: SettingsState = {
  general: generalSettingsMock,
  appearance: appearanceSettingsMock,
  permissions: permissionsMock,
  users: usersMock,
  units: unitsMock,
  modalities: modalitiesMock,
  contracts: contractsMock,
  contractSettings: contractSettingsMock,
  notifications: notificationsMock,
  integrations: integrationsMock,
  teacherAssets: teacherAssetsMock,
};
