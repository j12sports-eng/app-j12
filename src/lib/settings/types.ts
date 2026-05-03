import type { Role } from "@/lib/auth";

export type UserRole = Extract<
  Role,
  "admin" | "coordenador" | "professor" | "aluno" | "responsavel"
>;
export type SettingsSection =
  | "geral"
  | "aparencia"
  | "usuarios"
  | "unidades"
  | "modalidades"
  | "turmas"
  | "professores"
  | "contratos"
  | "notificacoes"
  | "integracoes";

export type ThemeMode = "dark" | "light";
export type ContractDocumentType = "contrato_principal" | "aditivo_contrato" | "direito_uso_imagem";

export interface SettingsUser {
  id: string;
  nome: string;
  email: string;
  senha: string;
  role: UserRole;
  teacherId?: string | null;
  studentId?: string | null;
  responsavelId?: string | null;
  classIds: string[];
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionRule {
  role: UserRole;
  accessLevel: string;
  profileScope: string;
  canViewSelfOnly: boolean;
  canEditSelfOnly: boolean;
}

export interface Unit {
  id: string;
  nome: string;
  endereco: string;
  telefone: string;
}

export interface ModalityItem {
  id: string;
  nome: string;
  descricao: string;
  destaque: string;
  ativa: boolean;
}

export interface ContractTemplateSetting {
  id: string;
  nome: string;
  titulo: string;
  conteudo: string;
  ativo: boolean;
  documentType: ContractDocumentType;
  updatedAt: string;
}

export interface ContractSettingsData {
  enableContract: boolean;
  enableContractAddendum: boolean;
  enableImageRights: boolean;
  defaultContractTemplate: string;
  defaultAddendumTemplate: string;
  defaultImageRightsTemplate: string;
}

export interface TeacherAssetSetting {
  teacherId: string;
  crefFileName: string;
  contractFileName: string;
}

export interface GeneralSettingsData {
  companyName: string;
  cnpj: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  logoDataUrl: string;
  slogan: string;
}

export interface AppearanceSettingsData {
  mode: ThemeMode;
  headerColor: string;
  footerColor: string;
  menuColor: string;
  menuBackgroundColor: string;
  pageBackgroundColor: string;
  primaryColor: string;
  secondaryColor: string;
  buttonColor: string;
  menuTextColor: string;
  headerTextColor: string;
  cardColor: string;
  textColor: string;
}

export interface NotificationSettingsData {
  lessonReminder: boolean;
  billing: boolean;
  absence: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  birthdayReminderEnabled: boolean;
  birthdayReminderType: "today" | "days_before" | "week" | "month";
  birthdayReminderMessage: string;
  birthdayReminderDaysBefore: number;
  birthdayReminderChannel: "painel" | "email" | "whatsapp" | "dashboard";
}

export interface IntegrationSettingsData {
  bankProvider: string;
  pixKey: string;
  apiKey: string;
  webhookUrl: string;
  automationToken: string;
}

export interface SettingsState {
  general: GeneralSettingsData;
  appearance: AppearanceSettingsData;
  permissions: PermissionRule[];
  users: SettingsUser[];
  units: Unit[];
  modalities: ModalityItem[];
  contracts: ContractTemplateSetting[];
  contractSettings: ContractSettingsData;
  notifications: NotificationSettingsData;
  integrations: IntegrationSettingsData;
  teacherAssets: TeacherAssetSetting[];
}
