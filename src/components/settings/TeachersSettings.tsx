import { useEffect, useMemo, useState } from "react";
import { FileUp, Pencil, Plus, Trash2, UserCog } from "lucide-react";
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
import { settingsStore, useSettingsState } from "@/lib/settings/settings-store";
import {
  assignTeacherToTurmas,
  toProfessorInput,
  syncProfessorTurmaNames,
} from "@/lib/settings/sync";
import {
  professoresStore,
  professorCanHandleClass,
  useProfessores,
  todayIso,
  FORMA_PAGAMENTO_PROFESSOR_OPTIONS,
  type Professor,
} from "@/lib/professores-store";
import { MODALIDADES, type Modalidade } from "@/lib/alunos-store";
import { useTurmas } from "@/lib/turmas-store";
import { SettingsEmptyState, SettingsPanel } from "./shared";

type TeacherFormState = {
  nome: string;
  telefone: string;
  email: string;
  cref: string;
  modalidades: Modalidade[];
  unidades: string[];
  turmaIds: string[];
};

const defaultForm: TeacherFormState = {
  nome: "",
  telefone: "",
  email: "",
  cref: "",
  modalidades: [MODALIDADES[0]],
  unidades: [],
  turmaIds: [],
};

export function TeachersSettings() {
  const professores = useProfessores();
  const turmas = useTurmas();
  const settings = useSettingsState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Professor | null>(null);
  const [form, setForm] = useState<TeacherFormState>(defaultForm);

  const units = settings.units;
  const teacherAssets = settings.teacherAssets;

  const compatibleTurmas = useMemo(
    () => turmas.filter((turma) => professorCanHandleClass(form, turma)),
    [form, turmas],
  );

  useEffect(() => {
    setForm((current) => ({
      ...current,
      turmaIds: current.turmaIds.filter((turmaId) =>
        compatibleTurmas.some((turma) => turma.id === turmaId),
      ),
    }));
  }, [compatibleTurmas]);

  function openCreate() {
    setEditingTeacher(null);
    setForm({
      ...defaultForm,
      unidades: units[0]?.nome ? [units[0].nome] : [],
    });
    setDialogOpen(true);
  }

  function openEdit(teacher: Professor) {
    const turmaIds = turmas
      .filter((turma) => turma.professorId === teacher.id)
      .map((turma) => turma.id);
    setEditingTeacher(teacher);
    setForm({
      nome: teacher.nome,
      telefone: teacher.telefone,
      email: teacher.email,
      cref: teacher.cref,
      modalidades: teacher.modalidades,
      unidades: teacher.unidades,
      turmaIds,
    });
    setDialogOpen(true);
  }

  function toggleTurma(turmaId: string) {
    setForm((current) => ({
      ...current,
      turmaIds: current.turmaIds.includes(turmaId)
        ? current.turmaIds.filter((item) => item !== turmaId)
        : [...current.turmaIds, turmaId],
    }));
  }

  function toggleModalidade(modalidade: Modalidade) {
    setForm((current) => ({
      ...current,
      modalidades: current.modalidades.includes(modalidade)
        ? current.modalidades.filter((item) => item !== modalidade)
        : [...current.modalidades, modalidade],
    }));
  }

  function toggleUnidade(unidade: string) {
    setForm((current) => ({
      ...current,
      unidades: current.unidades.includes(unidade)
        ? current.unidades.filter((item) => item !== unidade)
        : [...current.unidades, unidade],
    }));
  }

  function handleTeacherFileUpload(
    teacherId: string,
    field: "crefFileName" | "contractFileName",
    fileList: FileList | null,
  ) {
    const file = fileList?.[0];
    if (!file) return;

    const currentAsset = settingsStore.getTeacherAsset(teacherId);
    settingsStore.saveTeacherAsset({
      teacherId,
      crefFileName: field === "crefFileName" ? file.name : (currentAsset?.crefFileName ?? ""),
      contractFileName:
        field === "contractFileName" ? file.name : (currentAsset?.contractFileName ?? ""),
    });

    toast.success("Arquivo registrado para integracao futura.");
  }

  function handleSave() {
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error("Nome e e-mail do professor sao obrigatorios.");
      return;
    }

    if (form.modalidades.length === 0) {
      toast.error("Selecione pelo menos uma modalidade.");
      return;
    }

    if (form.unidades.length === 0) {
      toast.error("Selecione pelo menos uma unidade.");
      return;
    }

    if (editingTeacher) {
      professoresStore.update(editingTeacher.id, {
        ...toProfessorInput(editingTeacher),
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        email: form.email.trim(),
        cref: form.cref.trim(),
        modalidades: form.modalidades,
        unidades: form.unidades,
      });

      const result = assignTeacherToTurmas(editingTeacher.id, form.nome.trim(), form.turmaIds);
      if (result.invalidClassIds.length > 0) {
        toast.warning("Algumas turmas foram ignoradas por nao combinarem com as unidades/modalidades.");
      } else {
        toast.success("Professor atualizado.");
      }
    } else {
      const novoProfessor = professoresStore.create({
        nome: form.nome.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim(),
        cpf: "000.000.000-00",
        cref: form.cref.trim(),
        modalidades: form.modalidades,
        unidades: form.unidades,
        status: "ativo",
        turmas: [],
        jornadaProfessor: "A definir",
        tipoContrato: "Prestacao de servicos",
        valorContrato: 0,
        formaPagamentoProfessor: FORMA_PAGAMENTO_PROFESSOR_OPTIONS[0],
        dataInicioContrato: todayIso(),
        observacoesContrato: "",
      });

      const result = assignTeacherToTurmas(novoProfessor.id, form.nome.trim(), form.turmaIds);
      if (result.invalidClassIds.length > 0) {
        toast.warning("Professor criado, mas algumas turmas nao eram compatÃ­veis e nao foram vinculadas.");
      } else {
        toast.success("Professor criado.");
      }
    }

    syncProfessorTurmaNames();
    setDialogOpen(false);
  }

  function handleDelete(teacher: Professor) {
    if (!window.confirm(`Excluir o professor ${teacher.nome}?`)) return;
    professoresStore.remove(teacher.id);
    assignTeacherToTurmas(teacher.id, "A definir", []);
    toast.success("Professor removido.");
  }

  return (
    <SettingsPanel
      title="Professores"
      description="Administre equipe, documentos, vinculos com turmas e preparacao contratual."
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {professores.length} professor(es) gerenciados com integracao ao modulo Professores.
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo professor
        </Button>
      </div>

      {professores.length === 0 ? (
        <SettingsEmptyState
          title="Nenhum professor cadastrado"
          description="Crie perfis da equipe tecnica para conectar presenca, turmas e contratos."
          icon={UserCog}
        />
      ) : (
        <div className="grid gap-4">
          {professores.map((teacher) => {
            const asset = teacherAssets.find((item) => item.teacherId === teacher.id);
            return (
              <article key={teacher.id} className="j12-surface p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold text-foreground">{teacher.nome}</h4>
                      <Badge className="bg-primary/10 text-primary">{teacher.status}</Badge>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {teacher.email} - {teacher.telefone}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {teacher.modalidades.map((modalidade) => (
                        <Badge key={modalidade} className="border-primary/30 bg-primary/15 text-primary">
                          {modalidade}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {teacher.unidades.map((unidade) => (
                        <Badge key={unidade} className="border-border bg-card/70 text-foreground/80">
                          {unidade}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {teacher.turmas.length > 0 ? (
                        teacher.turmas.map((turma) => (
                          <Badge key={turma} className="border-border bg-card/70 text-foreground/80">
                            {turma}
                          </Badge>
                        ))
                      ) : (
                        <Badge className="border-border bg-card/70 text-muted-foreground">
                          Sem turmas
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      CREF: {asset?.crefFileName || teacher.cref || "Nao enviado"} | Contrato:{" "}
                      {asset?.contractFileName || "Pendente de upload"}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <label className="j12-field inline-flex cursor-pointer items-center justify-center px-3 py-2 text-sm text-foreground/90">
                      <FileUp className="h-4 w-4" />
                      <input
                        type="file"
                        className="hidden"
                        onChange={(event) =>
                          handleTeacherFileUpload(teacher.id, "crefFileName", event.target.files)
                        }
                      />
                    </label>
                    <label className="j12-field inline-flex cursor-pointer items-center justify-center px-3 py-2 text-sm text-foreground/90">
                      <FileUp className="h-4 w-4" />
                      <input
                        type="file"
                        className="hidden"
                        onChange={(event) =>
                          handleTeacherFileUpload(
                            teacher.id,
                            "contractFileName",
                            event.target.files,
                          )
                        }
                      />
                    </label>
                    <Button variant="outline" size="sm" onClick={() => openEdit(teacher)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(teacher)}
                      className="border-red-400/30 text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingTeacher ? "Editar professor" : "Novo professor"}</DialogTitle>
            <DialogDescription>
              Os vinculos definidos aqui atualizam o modulo Professores e o responsavel das turmas
              selecionadas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Nome"
              value={form.nome}
              onChange={(value) => setForm((current) => ({ ...current, nome: value }))}
            />
            <Field
              label="Telefone"
              value={form.telefone}
              onChange={(value) => setForm((current) => ({ ...current, telefone: value }))}
            />
            <Field
              label="E-mail"
              value={form.email}
              onChange={(value) => setForm((current) => ({ ...current, email: value }))}
            />
            <Field
              label="CREF"
              value={form.cref}
              onChange={(value) => setForm((current) => ({ ...current, cref: value }))}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="j12-surface p-4">
              <div className="text-sm font-medium text-foreground">Modalidades</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {form.modalidades.map((modalidade) => (
                  <Badge key={modalidade} className="border-primary/30 bg-primary/15 text-primary">
                    {modalidade}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {MODALIDADES.map((modalidade) => {
                  const checked = form.modalidades.includes(modalidade);
                  return (
                    <button
                      key={modalidade}
                      type="button"
                      onClick={() => toggleModalidade(modalidade)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        checked
                          ? "border-primary/40 bg-primary/15 text-foreground"
                          : "border-border bg-card/70 text-foreground/80 hover:border-primary/20 hover:bg-card"
                      }`}
                    >
                      {modalidade}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="j12-surface p-4">
              <div className="text-sm font-medium text-foreground">Unidades</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {form.unidades.map((unidade) => (
                  <Badge key={unidade} className="border-primary/30 bg-primary/15 text-primary">
                    {unidade}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {units.map((unit) => {
                  const checked = form.unidades.includes(unit.nome);
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => toggleUnidade(unit.nome)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        checked
                          ? "border-primary/40 bg-primary/15 text-foreground"
                          : "border-border bg-card/70 text-foreground/80 hover:border-primary/20 hover:bg-card"
                      }`}
                    >
                      {unit.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="j12-surface p-4">
            <div className="text-sm font-medium text-foreground">Turmas vinculadas</div>
            <div className="mt-2 text-sm text-muted-foreground">
              Somente turmas compatÃ­veis com as unidades e modalidades selecionadas aparecem aqui.
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {compatibleTurmas.map((turma) => (
                <label
                  key={turma.id}
                  className="j12-panel-section flex items-start gap-3 rounded-2xl p-3 text-sm text-foreground/80"
                >
                  <input
                    type="checkbox"
                    checked={form.turmaIds.includes(turma.id)}
                    onChange={() => toggleTurma(turma.id)}
                  />
                  <span>
                    <span className="block font-medium text-foreground">{turma.nome}</span>
                    <span className="block text-xs text-muted-foreground">
                      {turma.modalidade} - {turma.unidade}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingTeacher ? "Salvar professor" : "Criar professor"}
            </Button>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="j12-field" />
    </div>
  );
}
