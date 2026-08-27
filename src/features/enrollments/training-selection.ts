export function normalizeTurmaId(value: unknown): string {
  return String(value ?? "");
}

export function isSameTurmaId(left: unknown, right: unknown): boolean {
  return normalizeTurmaId(left) === normalizeTurmaId(right);
}

type TrainingSelectionBlock = {
  turmaId: unknown;
  modalidade: string;
  unidade: string;
};

type TrainingSelectionOption = {
  turmaId: unknown;
  turmaNome: string;
  modalidade: string;
  unidade: string;
  horarioLabel: string;
};

export function buildTrainingSelectionPayload(
  trainingBlocks: readonly TrainingSelectionBlock[],
  horarioOptions: readonly TrainingSelectionOption[],
) {
  const payload = {
    modalidades: [] as string[],
    unidades: [] as string[],
    turmas: [] as string[],
    horarios: [] as string[],
  };

  for (const training of trainingBlocks) {
    const turmaId = normalizeTurmaId(training.turmaId);
    if (!training.modalidade || !training.unidade || !turmaId) continue;

    const option = horarioOptions.find(
      (candidate) =>
        isSameTurmaId(candidate.turmaId, turmaId) &&
        candidate.modalidade === training.modalidade &&
        candidate.unidade === training.unidade,
    );
    if (!option) continue;

    // Arrays paralelos: cada bloco resolvido acrescenta exatamente um valor a cada campo.
    payload.modalidades.push(option.modalidade);
    payload.unidades.push(option.unidade);
    payload.turmas.push(option.turmaNome);
    payload.horarios.push(option.horarioLabel);
  }

  return payload;
}
