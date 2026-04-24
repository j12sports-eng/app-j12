import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MODALIDADES, type Modalidade } from "@/lib/alunos-store";
import { settingsStore, useSettingsState } from "@/lib/settings/settings-store";
import { syncProfessorTurmaNames } from "@/lib/settings/sync";
import { professorCanHandleClass, useProfessores } from "@/lib/professores-store";
import { turmasStore, useTurmas, type DiaSemana, type Turma } from "@/lib/turmas-store";
import { SettingsEmptyState, SettingsPanel } from "./shared";

const days: Array<{ value: DiaSemana; label: string }> = [
  { value: "seg", label: "Seg" },
  { value: "ter", label: "Ter" },
  { value: "qua", label: "Qua" },
  { value: "qui", label: "Qui" },
  { value: "sex", label: "Sex" },
  { value: "sab", label: "Sab" },
  { value: "dom", label: "Dom" },
];

type ClassFormState = {
  nome: string;
  modalidade: Modalidade;
  unidade: string;
  professorId: string;
  diasSemana: DiaSemana[];
  horarioInicio: string;
  horarioFim: string;
  capacidadeMaxima: string;
  ativa: boolean;
};

const defaultForm: ClassFormState = {
  nome: "",
  modalidade: MODALIDADES[0],
  unidade: "",
  professorId: "",
  diasSemana: ["seg", "qua"],
  horarioInicio: "08:00",
  horarioFim: "09:00",
  capacidadeMaxima: "20",
  ativa: true,
};

export function ClassesSettings() {
  const turmas = useTurmas();
  const professores = useProfessores();
  const settings = useSettingsState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Turma | null>(null);
  const [form, setForm] = useState<ClassFormState>(defaultForm);

  const activeTeachers = useMemo(
    () => professores.filter((professor) => professor.status !== "inativo"),
    [professores],
  );

  const compatibleTeachers = useMemo(
    () =>
      activeTeachers.filter((professor) =>
        professorCanHandleClass(professor, {
          modalidade: form.modalidade,
          unidade: form.unidade,
        }),
      ),
    [activeTeachers, form.modalidade, form.unidade],
  );

  useEffect(() => {
    if (form.professorId && !compatibleTeachers.some((professor) => professor.id === form.professorId)) {
      setForm((current) => ({ ...current, professorId: "" }));
    }
  }, [compatibleTeachers, form.professorId]);

  function openCreate() {
    const defaultUnit = settings.units[0]?.nome ?? "";
    const defaultTeacher =
      activeTeachers.find((professor) =>
        professorCanHandleClass(professor, { modalidade: defaultForm.modalidade, unidade: defaultUnit }),
      )?.id ?? "";

    setEditingClass(null);
    setForm({
      ...defaultForm,
      unidade: defaultUnit,
      professorId: defaultTeacher,
    });
    setDialogOpen(true);
  }

  function openEdit(turma: Turma) {
    setEditingClass(turma);
    setForm({
      nome: turma.nome,
      modalidade: turma.modalidade,
      unidade: turma.unidade,
      professorId: turma.professorId ?? "",
      diasSemana: turma.diasSemana,
      horarioInicio: turma.horarioInicio,
      horarioFim: turma.horarioFim,
      capacidadeMaxima: String(turma.capacidadeMaxima),
      ativa: turma.ativa,
    });
    setDialogOpen(true);
  }

  function toggleDay(day: DiaSemana) {
    setForm((current) => ({
      ...current,
      diasSemana: current.diasSemana.includes(day)
        ? current.diasSemana.filter((item) => item !== day)
        : [...current.diasSemana, day],
    }));
  }

  function handleSave() {
    if (!form.nome.trim() || !form.unidade.trim()) {
      toast.error("Preencha nome da turma e unidade.");
      return;
    }

    if (form.diasSemana.length === 0) {
      toast.error("Selecione ao menos um dia da semana.");
      return;
    }

    const professor = compatibleTeachers.find((item) => item.id === form.professorId);
    if (form.professorId && !professor) {
      toast.error("O professor selecionado nao atende esta combinacao de unidade e modalidade.");
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      modalidade: form.modalidade,
      unidade: form.unidade.trim(),
      professorId: professor?.id ?? null,
      professor: professor?.nome ?? "A definir",
      diasSemana: form.diasSemana,
      horarioInicio: form.horarioInicio,
      horarioFim: form.horarioFim,
      capacidadeMaxima: Number(form.capacidadeMaxima) || 20,
      ativa: form.ativa,
    };

    if (editingClass) {
      turmasStore.update(editingClass.id, payload);
      toast.success("Turma atualizada.");
    } else {
      turmasStore.create(payload);
      toast.success("Turma criada.");
    }

    syncProfessorTurmaNames();
    setDialogOpen(false);
  }

  function handleDelete(turma: Turma) {
    if (!window.confirm(`Excluir a turma ${turma.nome}?`)) return;
    turmasStore.remove(turma.id);
    syncProfessorTurmaNames();
    toast.success("Turma removida.");
  }

  return (
    <SettingsPanel
      title="Turmas"
      description="Controle grade, modalidade, unidade, professor responsavel e limite de alunos."
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {turmas.length} turma(s) gerenciadas a partir do store real do modulo Turmas.
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova turma
        </Button>
      </div>

      {turmas.length === 0 ? (
        <SettingsEmptyState
          title="Nenhuma turma cadastrada"
          description="Cadastre a primeira turma para alimentar presenca, professores e agenda."
          icon={CalendarDays}
        />
      ) : (
        <div className="grid gap-4">
          {turmas.map((turma) => (
            <article key={turma.id} className="j12-surface p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-semibold text-foreground">{turma.nome}</h4>
                    <Badge
                      className={
                        turma.ativa
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-slate-500/15 text-slate-300"
                      }
                    >
                      {turma.ativa ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {turma.modalidade} - {turma.unidade} - {turma.professor}
                  </p>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {turma.diasSemana.join(", ")} | {turma.horarioInicio} - {turma.horarioFim} |
                    Limite {turma.capacidadeMaxima}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(turma)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(turma)}
                    className="border-red-400/30 text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingClass ? "Editar turma" : "Nova turma"}</DialogTitle>
            <DialogDescription>
              Qualquer alteracao aqui reflete diretamente no modulo Turmas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Nome"
              value={form.nome}
              onChange={(value) => setForm((current) => ({ ...current, nome: value }))}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Modalidade</label>
              <select
                value={form.modalidade}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    modalidade: event.target.value as Modalidade,
                  }))
                }
                className="j12-field h-10 w-full px-3 text-sm"
              >
                {MODALIDADES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Unidade</label>
              <select
                value={form.unidade}
                onChange={(event) =>
                  setForm((current) => ({ ...current, unidade: event.target.value }))
                }
                className="j12-field h-10 w-full px-3 text-sm"
              >
                <option value="">Selecione uma unidade</option>
                {settings.units.map((unit) => (
                  <option key={unit.id} value={unit.nome}>
                    {unit.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Professor responsavel</label>
              <select
                value={form.professorId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, professorId: event.target.value }))
                }
                className="j12-field h-10 w-full px-3 text-sm"
              >
                <option value="">A definir</option>
                {compatibleTeachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.nome}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Horario inicial"
              type="time"
              value={form.horarioInicio}
              onChange={(value) => setForm((current) => ({ ...current, horarioInicio: value }))}
            />
            <Field
              label="Horario final"
              type="time"
              value={form.horarioFim}
              onChange={(value) => setForm((current) => ({ ...current, horarioFim: value }))}
            />
            <Field
              label="Limite de alunos"
              type="number"
              value={form.capacidadeMaxima}
              onChange={(value) => setForm((current) => ({ ...current, capacidadeMaxima: value }))}
            />
            <label className="flex items-center gap-2 pt-8 text-sm text-foreground/80">
              <input
                type="checkbox"
                checked={form.ativa}
                onChange={(event) =>
                  setForm((current) => ({ ...current, ativa: event.target.checked }))
                }
              />
              Turma ativa
            </label>
          </div>

          <div className="j12-surface space-y-2 p-4">
            <div className="text-sm font-medium text-foreground">Dias da semana</div>
            <div className="flex flex-wrap gap-2">
              {days.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`rounded-2xl border px-4 py-2 text-sm transition ${
                    form.diasSemana.includes(day.value)
                      ? "border-primary/30 bg-primary/15 text-primary"
                      : "border-border bg-card/70 text-muted-foreground"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>{editingClass ? "Salvar turma" : "Criar turma"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsPanel>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="j12-field" />
    </div>
  );
}
