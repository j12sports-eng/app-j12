export function normalizeTurmaId(value: unknown): string {
  return String(value ?? "");
}

export function isSameTurmaId(left: unknown, right: unknown): boolean {
  return normalizeTurmaId(left) === normalizeTurmaId(right);
}
