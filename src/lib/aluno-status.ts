export type NormalizedAlunoStatus = "ativo" | "inativo" | "experimental" | "pendente";

export function normalizeAlunoStatus(value: unknown): NormalizedAlunoStatus {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized.includes("pendente")) return "pendente";
  if (normalized.includes("experimental")) return "experimental";
  if (normalized.includes("inativo")) return "inativo";
  if (normalized.includes("ativo")) return "ativo";
  return "ativo";
}
