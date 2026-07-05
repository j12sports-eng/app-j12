import type {
  Championship,
  ChampionshipMutationPayload,
  ChampionshipStatus,
} from "../types/championship.types";

export type ChampionshipFormValues = {
  category: string;
  description: string;
  endDate: string;
  modality: string;
  name: string;
  startDate: string;
  status: ChampionshipStatus;
};

export type ChampionshipFormErrors = Partial<Record<keyof ChampionshipFormValues, string>>;

export function createDefaultChampionshipFormValues(date = new Date()): ChampionshipFormValues {
  const today = toDateInput(date);
  const end = new Date(date);
  end.setDate(date.getDate() + 30);

  return {
    category: "Livre",
    description: "",
    endDate: toDateInput(end),
    modality: "Futsal",
    name: "",
    startDate: today,
    status: "DRAFT",
  };
}

export function validateChampionshipForm(values: ChampionshipFormValues): ChampionshipFormErrors {
  const errors: ChampionshipFormErrors = {};

  if (!values.name.trim()) errors.name = "Informe o nome do campeonato.";
  if (!values.category.trim()) errors.category = "Informe a categoria.";
  if (!values.modality.trim()) errors.modality = "Informe a modalidade.";
  if (!values.startDate) errors.startDate = "Informe a data inicial.";
  if (!values.endDate) errors.endDate = "Informe a data final.";

  if (values.startDate && values.endDate && values.startDate > values.endDate) {
    errors.endDate = "Data final deve ser posterior ou igual a inicial.";
  }

  return errors;
}

export function toChampionshipMutationPayload(
  values: ChampionshipFormValues,
): ChampionshipMutationPayload {
  return {
    category: values.category.trim(),
    description: values.description.trim() || null,
    endDate: values.endDate,
    modality: values.modality.trim(),
    name: values.name.trim(),
    startDate: values.startDate,
    status: values.status,
  };
}

export function toChampionshipFormValues(championship: Championship): ChampionshipFormValues {
  return {
    category: championship.category || "",
    description: championship.description || "",
    endDate: championship.endDate || "",
    modality: championship.modality || "",
    name: championship.name || "",
    startDate: championship.startDate || "",
    status: championship.status === "REMOVED" ? "DRAFT" : championship.status,
  };
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}
