import { settingsMock } from "./mocks/settingsMock";
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
  SettingsUser,
  TeacherAssetSetting,
  Unit,
} from "./types";

const STORAGE_KEY = "j12.settings.pro.v1";

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeWithDefaults(partial?: Partial<SettingsState> | null): SettingsState {
  return {
    ...cloneState(settingsMock),
    ...partial,
    general: {
      ...settingsMock.general,
      ...(partial?.general ?? {}),
    },
    appearance: {
      ...settingsMock.appearance,
      ...(partial?.appearance ?? {}),
    },
    permissions: Array.isArray(partial?.permissions) && partial.permissions.length > 0
      ? partial.permissions.map((item) => ({
          accessLevel: item.accessLevel || "restrito",
          profileScope: item.profileScope || "global",
          canViewSelfOnly: Boolean(item.canViewSelfOnly),
          canEditSelfOnly: Boolean(item.canEditSelfOnly),
          role: item.role,
        }))
      : cloneState(settingsMock.permissions),
    users: Array.isArray(partial?.users) ? partial.users : cloneState(settingsMock.users),
    units: Array.isArray(partial?.units) ? partial.units : cloneState(settingsMock.units),
    modalities: Array.isArray(partial?.modalities)
      ? partial.modalities
      : cloneState(settingsMock.modalities),
    contracts: Array.isArray(partial?.contracts)
      ? partial.contracts.map((item, index) => ({
          ...settingsMock.contracts[0],
          ...item,
          documentType: item.documentType || (index === 1 ? "aditivo_contrato" : index === 2 ? "direito_uso_imagem" : "contrato_principal"),
        }))
      : cloneState(settingsMock.contracts),
    contractSettings: {
      ...settingsMock.contractSettings,
      ...(partial?.contractSettings ?? {}),
    },
    notifications: {
      ...settingsMock.notifications,
      ...(partial?.notifications ?? {}),
    },
    integrations: {
      ...settingsMock.integrations,
      ...(partial?.integrations ?? {}),
    },
    teacherAssets: Array.isArray(partial?.teacherAssets)
      ? partial.teacherAssets
      : cloneState(settingsMock.teacherAssets),
  };
}

function withTimestamps<T extends { createdAt?: string; updatedAt?: string }>(value: T): T {
  const now = new Date().toISOString();
  return {
    ...value,
    createdAt: value.createdAt ?? now,
    updatedAt: now,
  };
}

function withUpdatedAt<T extends { updatedAt?: string }>(value: T): T {
  return {
    ...value,
    updatedAt: new Date().toISOString(),
  };
}

export const settingsService = {
  load(): SettingsState {
    return mergeWithDefaults(settingsMock);
  },

  normalize(partial?: Partial<SettingsState> | null): SettingsState {
    return mergeWithDefaults(partial);
  },

  save(_: SettingsState) {
    // Persistencia centralizada via backend.
  },

  createUser(input: Omit<SettingsUser, "id" | "createdAt" | "updatedAt">): SettingsUser {
    return withTimestamps({
      ...input,
      id: `usr-${Date.now()}`,
    });
  },

  updateUser(
    current: SettingsUser,
    data: Omit<SettingsUser, "id" | "createdAt" | "updatedAt">,
  ): SettingsUser {
    return withTimestamps({
      ...current,
      ...data,
      id: current.id,
      createdAt: current.createdAt,
    });
  },

  createUnit(input: Omit<Unit, "id">): Unit {
    return {
      ...input,
      id: `unit-${Date.now()}`,
    };
  },

  createModality(input: Omit<ModalityItem, "id" | "updatedAt">): ModalityItem {
    return withUpdatedAt({
      ...input,
      id: `mod-${Date.now()}`,
    });
  },

  updateModality(
    current: ModalityItem,
    data: Omit<ModalityItem, "id" | "updatedAt">,
  ): ModalityItem {
    return withUpdatedAt({
      ...current,
      ...data,
      id: current.id,
    });
  },

  createContract(
    input: Omit<ContractTemplateSetting, "id" | "updatedAt">,
  ): ContractTemplateSetting {
    return withUpdatedAt({
      ...input,
      id: `contract-${Date.now()}`,
    });
  },

  updateContract(
    current: ContractTemplateSetting,
    data: Omit<ContractTemplateSetting, "id" | "updatedAt">,
  ): ContractTemplateSetting {
    return withUpdatedAt({
      ...current,
      ...data,
      id: current.id,
    });
  },

  updateGeneral(current: GeneralSettingsData, data: GeneralSettingsData): GeneralSettingsData {
    return { ...current, ...data };
  },

  updateAppearance(
    current: AppearanceSettingsData,
    data: AppearanceSettingsData,
  ): AppearanceSettingsData {
    return { ...current, ...data };
  },

  updatePermissions(current: PermissionRule[], data: PermissionRule[]) {
    return data.length > 0 ? data : current;
  },

  updateContractSettings(current: ContractSettingsData, data: ContractSettingsData) {
    return { ...current, ...data };
  },

  updateNotifications(
    current: NotificationSettingsData,
    data: NotificationSettingsData,
  ): NotificationSettingsData {
    return { ...current, ...data };
  },

  updateIntegrations(
    current: IntegrationSettingsData,
    data: IntegrationSettingsData,
  ): IntegrationSettingsData {
    return { ...current, ...data };
  },

  upsertTeacherAsset(
    current: TeacherAssetSetting[],
    payload: TeacherAssetSetting,
  ): TeacherAssetSetting[] {
    const exists = current.some((item) => item.teacherId === payload.teacherId);
    if (exists) {
      return current.map((item) => (item.teacherId === payload.teacherId ? payload : item));
    }

    return [payload, ...current];
  },

  reset(): SettingsState {
    return mergeWithDefaults(settingsMock);
  },
};
