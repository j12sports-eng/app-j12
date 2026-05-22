import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Modalidade } from "@/lib/alunos-store";
import { useProfessores } from "@/lib/professores-store";
import { useSettingsState } from "@/lib/settings/settings-store";
import {
  TRIAL_CLASS_LEAD_SOURCES,
  TRIAL_CLASS_STATUS_OPTIONS,
  calculateTrialClassAge,
  isValidTrialPhone,
  trialClassesStore,
  type TrialClass,
  type TrialClassInput,
} from "@/lib/trial-classes-store";
import { useTurmas } from "@/lib/turmas-store";

type Mode = "create" | "edit" | "reschedule";

const emptyForm: TrialClassInput = {
  studentName: "",
  birthDate: "",
  notes: "",
  guardianName: "",
  phone: "",
  whatsapp: "",
  email: "",
  modality: "" as Modalidade,
  unit: "",
  turma: "",
  professor: "",
  date: "",
  time: "",
  status: "Agendada",
  leadSource: TRIAL_CLASS_LEAD_SOURCES[0],
};

function sanitizeProfessorName(value: string) {
  return value
    .replace(/^Prof\.?\s*/i, "")
    .replace(/^Profa\.?\s*/i, "")
    .trim();
}

export function TrialClassFormDialog({
  open,
  onOpenChange,
  trialClass,
  mode = "create",
  onSaved,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  trialClass?: TrialClass | null;
  mode?: Mode;
  onSaved?: (item: TrialClass) => void;
}) {
  const professores = useProfessores();
  const settings = useSettingsState();
  const turmas = useTurmas();
  const [form, setForm] = useState<TrialClassInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const activeProfessores = useMemo(
    () => professores.filter((professor) => professor.status === "ativo"),
    [professores],
  );

  const unitOptions = useMemo(() => {
    const fromTurmas = turmas
      .filter((turma) => turma.modalidade === form.modality)
      .map((turma) => turma.unidade);
    const fromProfessores = activeProfessores
      .filter((professor) => professor.modalidades.includes(form.modality))
      .flatMap((professor) => professor.unidades);

    return [...new Set([...fromTurmas, ...fromProfessores, form.unit].filter(Boolean))];
  }, [activeProfessores, form.modality, form.unit, turmas]);

  const compatibleProfessores = useMemo(
    () =>
      activeProfessores.filter(
        (professor) =>
          professor.modalidades.includes(form.modality) &&
          (!form.unit || professor.unidades.includes(form.unit)),
      ),
    [activeProfessores, form.modality, form.unit],
  );

  const professorOptions = useMemo(() => {
    const base = compatibleProfessores.map((professor) => professor.nome);
    if (base.length > 0) return base;

    const fallback = [...new Set(turmas.map((turma) => sanitizeProfessorName(turma.professor)))];
    return fallback.filter(Boolean);
  }, [compatibleProfessores, turmas]);

  const turmaOptions = useMemo(
    () =>
      turmas.filter(
        (turma) =>
          turma.modalidade === form.modality &&
          (!form.unit || turma.unidade === form.unit) &&
          (!form.professor || sanitizeProfessorName(turma.professor) === form.professor),
      ),
    [form.modality, form.professor, form.unit, turmas],
  );

  const age = useMemo(() => calculateTrialClassAge(form.birthDate), [form.birthDate]);
  const modalityOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...settings.modalities.filter((item) => item.ativa).map((item) => item.nome),
          ...turmas.map((turma) => turma.modalidade),
        ]),
      ) as Modalidade[],
    [settings.modalities, turmas],
  );
  const isReschedule = mode === "reschedule";
  const isEdit = Boolean(trialClass) && mode === "edit";

  useEffect(() => {
    if (!open) return;

    if (trialClass) {
      setForm({
        studentName: trialClass.studentName,
        birthDate: trialClass.birthDate,
        notes: trialClass.notes,
        guardianName: trialClass.guardianName,
        phone: trialClass.phone,
        whatsapp: trialClass.whatsapp,
        email: trialClass.email,
        modality: trialClass.modality,
        unit: trialClass.unit,
        turma: trialClass.turma,
        professor: trialClass.professor,
        date: trialClass.date,
        time: trialClass.time,
        status: isReschedule ? "Reagendada" : trialClass.status,
        leadSource: trialClass.leadSource,
      });
      return;
    }

    const initialTurma = turmas[0];
    setForm({
      ...emptyForm,
      modality: initialTurma?.modalidade ?? emptyForm.modality,
      unit: initialTurma?.unidade ?? "",
      turma: initialTurma?.nome ?? "",
      professor: sanitizeProfessorName(initialTurma?.professor ?? ""),
      time: initialTurma?.horarioInicio ?? "",
    });
  }, [isReschedule, open, trialClass, turmas]);

  useEffect(() => {
    if (!form.professor) return;
    if (professorOptions.includes(form.professor)) return;

    setForm((current) => ({
      ...current,
      professor: "",
      turma:
        current.turma && turmaOptions.some((turma) => turma.nome === current.turma)
          ? current.turma
          : "",
    }));
  }, [form.professor, professorOptions, turmaOptions]);

  useEffect(() => {
    if (!form.turma) return;
    if (turmaOptions.some((turma) => turma.nome === form.turma)) return;

    setForm((current) => ({
      ...current,
      turma: "",
      time: "",
    }));
  }, [form.turma, turmaOptions]);

  function updateField<K extends keyof TrialClassInput>(key: K, value: TrialClassInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSelectProfessor(professorNome: string) {
    const selectedProfessor = compatibleProfessores.find((item) => item.nome === professorNome);
    setForm((current) => ({
      ...current,
      professor: professorNome,
      unit:
        selectedProfessor && !selectedProfessor.unidades.includes(current.unit)
          ? (selectedProfessor.unidades[0] ?? current.unit)
          : current.unit,
      turma: "",
    }));
  }

  function handleSelectTurma(turmaNome: string) {
    const selected = turmas.find((turma) => turma.nome === turmaNome);
    updateField("turma", turmaNome);

    if (!selected) return;

    setForm((current) => ({
      ...current,
      turma: turmaNome,
      unit: selected.unidade,
      professor: sanitizeProfessorName(selected.professor),
      time: selected.horarioInicio,
      modality: selected.modalidade,
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (
      !form.studentName.trim() ||
      !form.guardianName.trim() ||
      !form.phone.trim() ||
      !form.modality ||
      !form.unit.trim() ||
      !form.turma.trim() ||
      !form.professor.trim() ||
      !form.date ||
      !form.time
    ) {
      toast.error("Preencha os campos obrigatorios da aula experimental.");
      return;
    }

    if (!isValidTrialPhone(form.phone) || (form.whatsapp && !isValidTrialPhone(form.whatsapp))) {
      toast.error("Informe telefone e WhatsApp com DDD valido.");
      return;
    }

    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    try {
      const payload: TrialClassInput = {
        ...form,
        studentName: form.studentName.trim(),
        notes: form.notes.trim(),
        guardianName: form.guardianName.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim(),
        unit: form.unit.trim(),
        turma: form.turma.trim(),
        professor: form.professor.trim(),
      };

      let saved: TrialClass | null = null;

      if (trialClass && isReschedule) {
        saved = trialClassesStore.reschedule(trialClass.id, payload);
        toast.success("Aula experimental reagendada.");
      } else if (trialClass) {
        saved = trialClassesStore.update(trialClass.id, payload);
        toast.success("Aula experimental atualizada.");
      } else {
        saved = trialClassesStore.create(payload);
        toast.success("Aula experimental criada.");
      }

      if (saved) onSaved?.(saved);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-primary/20 bg-[#070b14] text-slate-100 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {isReschedule
              ? "Reagendar aula experimental"
              : isEdit
                ? "Editar aula experimental"
                : "Nova aula experimental"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Cadastre o lead, organize o agendamento e deixe o fluxo pronto para conversao.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-3xl border border-primary/15 bg-white/5 p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Aluno
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Nome do aluno *</Label>
                <Input
                  value={form.studentName}
                  onChange={(event) => updateField("studentName", event.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Nascimento</Label>
                <Input
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => updateField("birthDate", event.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Idade calculada</Label>
                <div className="mt-2 flex h-10 items-center rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-slate-300">
                  {age === null ? "Preencha a data" : `${age} ano(s)`}
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Observacoes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  className="mt-2 min-h-[110px] border-input bg-input/40"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-primary/15 bg-white/5 p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Responsavel
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Nome do responsavel *</Label>
                <Input
                  value={form.guardianName}
                  onChange={(event) => updateField("guardianName", event.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Telefone *</Label>
                <Input
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="(11) 99999-9999"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input
                  value={form.whatsapp}
                  onChange={(event) => updateField("whatsapp", event.target.value)}
                  placeholder="(11) 99999-9999"
                  className="mt-2"
                />
              </div>
              <div className="md:col-span-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-primary/15 bg-white/5 p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Agendamento
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Modalidade *</Label>
                <select
                  value={form.modality}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      modality: event.target.value as Modalidade,
                      professor: "",
                      turma: "",
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {modalityOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Unidade *</Label>
                <input
                  list="trial-class-units"
                  value={form.unit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      unit: event.target.value,
                      professor: "",
                      turma: "",
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <datalist id="trial-class-units">
                  {unitOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label>Turma *</Label>
                <select
                  value={form.turma}
                  onChange={(event) => handleSelectTurma(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Selecione</option>
                  {turmaOptions.map((item) => (
                    <option key={item.id} value={item.nome}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Professor *</Label>
                <select
                  value={form.professor}
                  onChange={(event) => handleSelectProfessor(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Selecione</option>
                  {professorOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(event) => updateField("date", event.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Horario *</Label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(event) => updateField("time", event.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    updateField("status", event.target.value as TrialClass["status"])
                  }
                  className="mt-2 w-full rounded-lg border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {TRIAL_CLASS_STATUS_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Origem</Label>
                <select
                  value={String(form.leadSource)}
                  onChange={(event) => updateField("leadSource", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-input bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {TRIAL_CLASS_LEAD_SOURCES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving
                ? "Salvando..."
                : isReschedule
                  ? "Salvar reagendamento"
                  : isEdit
                    ? "Salvar aula experimental"
                    : "Criar aula experimental"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
