import { useSyncExternalStore } from "react";
import { modalidadesStore } from "../modalidades-store";
import { createRemoteCollectionStore } from "../remote-collection";
import { unidadesStore } from "../unidades-store";
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
  {
    emptyState: settingsService.normalize({
      users: [],
      units: [],
      modalities: [],
      contracts: [],
      teacherAssets: [],
    }),
  },
);
let state: SettingsState = settingsService.normalize(settingsCollection.getSnapshot());
const listeners = new Set<() => void>();

function mapUnitsFromOfficialTables() {
  return unidadesStore.getSnapshot().map((unit) => ({
    id: unit.id,
    nome: unit.nome,
    endereco: unit.endereco,
    telefone: unit.telefone,
  }));
}

function mapModalitiesFromOfficialTables() {
  return modalidadesStore.getSnapshot().map((item) => ({
    id: item.id,
    nome: item.nome,
    descricao: item.descricao,
    destaque: item.destaque,
    ativa: item.ativa,
    updatedAt: new Date().toISOString(),
  }));
}

function syncStateFromSources() {
  state = settingsService.normalize({
    ...settingsCollection.getSnapshot(),
    units: mapUnitsFromOfficialTables(),
    modalities: mapModalitiesFromOfficialTables(),
  });
}

syncStateFromSources();

settingsCollection.subscribe(() => {
  syncStateFromSources();
  listeners.forEach((listener) => listener());
});

unidadesStore.subscribe(() => {
  syncStateFromSources();
  listeners.forEach((listener) => listener());
});

modalidadesStore.subscribe(() => {
  syncStateFromSources();
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

  reload() {
    return Promise.all([
      settingsCollection.reload(),
      unidadesStore.reload(),
      modalidadesStore.reload(),
    ]);
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
    const unit = unidadesStore.create({
      ...data,
      cidade: "",
      estado: "",
      ativa: true,
      status: "ativo",
    });
    syncStateFromSources();
    emit();
    return {
      id: unit.id,
      nome: unit.nome,
      endereco: unit.endereco,
      telefone: unit.telefone,
    };
  },

  updateUnit(id: string, data: Omit<Unit, "id">) {
    unidadesStore.update(id, {
      ...data,
      cidade: "",
      estado: "",
      ativa: true,
      status: "ativo",
    });
    syncStateFromSources();
    emit();
  },

  removeUnit(id: string) {
    unidadesStore.remove(id);
    syncStateFromSources();
    emit();
  },

  createModality(data: Omit<ModalityItem, "id" | "updatedAt">) {
    const modality = modalidadesStore.create({
      ...data,
      status: data.ativa ? "ativo" : "inativo",
    });
    syncStateFromSources();
    emit();
    return {
      id: modality.id,
      nome: modality.nome,
      descricao: modality.descricao,
      destaque: modality.destaque,
      ativa: modality.ativa,
      updatedAt: new Date().toISOString(),
    };
  },

  updateModality(id: string, data: Omit<ModalityItem, "id" | "updatedAt">) {
    modalidadesStore.update(id, {
      ...data,
      status: data.ativa ? "ativo" : "inativo",
    });
    syncStateFromSources();
    emit();
  },

  removeModality(id: string) {
    modalidadesStore.remove(id);
    syncStateFromSources();
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

export function useSettingsStatus() {
  return useSyncExternalStore(
    settingsStore.subscribe,
    settingsCollection.getMeta,
    settingsCollection.getMeta,
  );
}
