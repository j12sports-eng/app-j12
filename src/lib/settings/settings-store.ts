import { useSyncExternalStore } from "react";
import { createRemoteCollectionStore } from "../remote-collection";
import { settingsService } from "./settingsService";
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

const settingsCollection = createRemoteCollectionStore<SettingsState>(
  "settings",
  settingsService.load(),
);
let state: SettingsState = settingsService.normalize(settingsCollection.getSnapshot());
const listeners = new Set<() => void>();

settingsCollection.subscribe(() => {
  state = settingsService.normalize(settingsCollection.getSnapshot());
  listeners.forEach((listener) => listener());
});

function emit() {
  settingsCollection.replaceState(settingsService.normalize(state));
}

export const settingsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot() {
    return state;
  },

  getUserById(id: string) {
    return state.users.find((user) => user.id === id) ?? null;
  },

  getTeacherAsset(teacherId: string) {
    return state.teacherAssets.find((item) => item.teacherId === teacherId) ?? null;
  },

  saveGeneral(data: GeneralSettingsData) {
    state = {
      ...state,
      general: settingsService.updateGeneral(state.general, data),
    };
    emit();
  },

  saveAppearance(data: AppearanceSettingsData) {
    state = {
      ...state,
      appearance: settingsService.updateAppearance(state.appearance, data),
    };
    emit();
  },

  savePermissions(data: PermissionRule[]) {
    state = {
      ...state,
      permissions: settingsService.updatePermissions(state.permissions, data),
    };
    emit();
  },

  createUser(data: Omit<SettingsUser, "id" | "createdAt" | "updatedAt">) {
    const user = settingsService.createUser(data);
    state = {
      ...state,
      users: [user, ...state.users],
    };
    emit();
    return user;
  },

  updateUser(id: string, data: Omit<SettingsUser, "id" | "createdAt" | "updatedAt">) {
    state = {
      ...state,
      users: state.users.map((user) =>
        user.id === id ? settingsService.updateUser(user, data) : user,
      ),
    };
    emit();
  },

  removeUser(id: string) {
    state = {
      ...state,
      users: state.users.filter((user) => user.id !== id),
    };
    emit();
  },

  createUnit(data: Omit<Unit, "id">) {
    const unit = settingsService.createUnit(data);
    state = {
      ...state,
      units: [unit, ...state.units],
    };
    emit();
    return unit;
  },

  updateUnit(id: string, data: Omit<Unit, "id">) {
    state = {
      ...state,
      units: state.units.map((unit) => (unit.id === id ? { ...unit, ...data } : unit)),
    };
    emit();
  },

  removeUnit(id: string) {
    state = {
      ...state,
      units: state.units.filter((unit) => unit.id !== id),
    };
    emit();
  },

  createModality(data: Omit<ModalityItem, "id" | "updatedAt">) {
    const modality = settingsService.createModality(data);
    state = {
      ...state,
      modalities: [modality, ...state.modalities],
    };
    emit();
    return modality;
  },

  updateModality(id: string, data: Omit<ModalityItem, "id" | "updatedAt">) {
    state = {
      ...state,
      modalities: state.modalities.map((modality) =>
        modality.id === id ? settingsService.updateModality(modality, data) : modality,
      ),
    };
    emit();
  },

  removeModality(id: string) {
    state = {
      ...state,
      modalities: state.modalities.filter((modality) => modality.id !== id),
    };
    emit();
  },

  createContract(data: Omit<ContractTemplateSetting, "id" | "updatedAt">) {
    const contract = settingsService.createContract(data);
    state = {
      ...state,
      contracts: [contract, ...state.contracts],
    };
    emit();
    return contract;
  },

  updateContract(id: string, data: Omit<ContractTemplateSetting, "id" | "updatedAt">) {
    state = {
      ...state,
      contracts: state.contracts.map((contract) =>
        contract.id === id ? settingsService.updateContract(contract, data) : contract,
      ),
    };
    emit();
  },

  removeContract(id: string) {
    state = {
      ...state,
      contracts: state.contracts.filter((contract) => contract.id !== id),
    };
    emit();
  },

  saveContractSettings(data: ContractSettingsData) {
    state = {
      ...state,
      contractSettings: settingsService.updateContractSettings(state.contractSettings, data),
    };
    emit();
  },

  saveNotifications(data: NotificationSettingsData) {
    state = {
      ...state,
      notifications: settingsService.updateNotifications(state.notifications, data),
    };
    emit();
  },

  saveIntegrations(data: IntegrationSettingsData) {
    state = {
      ...state,
      integrations: settingsService.updateIntegrations(state.integrations, data),
    };
    emit();
  },

  saveTeacherAsset(payload: TeacherAssetSetting) {
    state = {
      ...state,
      teacherAssets: settingsService.upsertTeacherAsset(state.teacherAssets, payload),
    };
    emit();
  },

  reset() {
    state = settingsService.reset();
    emit();
  },
};

export function useSettingsState() {
  return useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.getSnapshot,
    settingsStore.getSnapshot,
  );
}
