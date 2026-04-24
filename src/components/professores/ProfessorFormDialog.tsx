import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { type Modalidade } from "@/lib/alunos-store";
import {
  FORMA_PAGAMENTO_PROFESSOR_OPTIONS,
  professoresStore,
  professorCanHandleClass,
  STATUS_PROFESSOR_OPTIONS,
  TIPO_CONTRATO_OPTIONS,
  type FormaPagamentoProfessor,
  type Professor,
  type StatusProfessor,
} from "@/lib/professores-store";
import { useSettingsState } from "@/lib/settings/settings-store";
import { useTurmas } from "@/lib/turmas-store";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  professor?: Professor | null;
}

const emptyForm = {
  nome: "",
  email: "",
  telefone: "",
  cpf: "",
  cref: "",
  modalidades: ["Futebol"] as Modalidade[],
  unidades: [] as string[],
  status: "ativo" as StatusProfessor,
  turmas: [] as string[],
  jornadaProfessor: "",
  tipoContrato: TIPO_CONTRATO_OPTIONS[0],
  valorContrato: 0,
  formaPagamentoProfessor: FORMA_PAGAMENTO_PROFESSOR_OPTIONS[0] as FormaPagamentoProfessor,
  dataInicioContrato: "",
  observacoesContrato: "",
};

export function ProfessorFormDialog({ open, onOpenChange, professor }: Props) {
  const turmas = useTurmas();
  const settings = useSettingsState();
  const isEdit = Boolean(professor);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const availableModalidades = useMemo(
    () =>
      [...new Set([...settings.modalities.filter((item) => item.ativa).map((item) => item.nome), ...turmas.map((turma) => turma.modalidade)])].filter(Boolean),
    [settings.modalities, turmas],
  );

  const availableUnits = useMemo(
    () =>
      [...new Set([...settings.units.map((unit) => unit.nome), ...turmas.map((turma) => turma.unidade)])].filter(
        Boolean,
      ),
    [settings.units, turmas],
  );

  const compatibleTurmas = useMemo(
    () =>
      turmas
        .filter((turma) => professorCanHandleClass(form, turma))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [form, turmas],
  );

  useEffect(() => {
    if (!open) return;

    if (professor) {
      setForm({
        nome: professor.nome,
        email: professor.email,
        telefone: professor.telefone,
        cpf: professor.cpf,
        cref: professor.cref,
        modalidades: professor.modalidades,
        unidades: professor.unidades,
        status: professor.status,
        turmas: professor.turmas,
        jornadaProfessor: professor.jornadaProfessor,
        tipoContrato: professor.tipoContrato,
        valorContrato: professor.valorContrato,
        formaPagamentoProfessor: professor.formaPagamentoProfessor,
        dataInicioContrato: professor.dataInicioContrato,
        observacoesContrato: professor.observacoesContrato,
      });
      return;
    }

    setForm({
      ...emptyForm,
      unidades: settings.units[0]?.nome ? [settings.units[0].nome] : [],
    });
  }, [open, professor, settings.units]);

  useEffect(() => {
    if (!open) return;

    setForm((current) => {
      const nextTurmas = current.turmas.filter((nomeTurma) =>
        compatibleTurmas.some((turma) => turma.nome === nomeTurma),
      );

      const sameLength = nextTurmas.length === current.turmas.length;
      const sameValues = sameLength && nextTurmas.every((turma, index) => turma === current.turmas[index]);

      if (sameValues) return current;

      return {
        ...current,
        turmas: nextTurmas,
      };
    });
  }, [compatibleTurmas, open]);

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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

  function toggleTurma(nomeTurma: string) {
    setForm((current) => ({
      ...current,
      turmas: current.turmas.includes(nomeTurma)
        ? current.turmas.filter((item) => item !== nomeTurma)
        : [...current.turmas, nomeTurma],
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!form.nome.trim() || !form.email.trim() || !form.telefone.trim()) {
      toast.error("Preencha nome, e-mail e telefone do professor.");
      return;
    }

    if (!form.cpf.trim()) {
      toast.error("Preencha o CPF do professor.");
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

    if (!form.tipoContrato.trim() || form.valorContrato <= 0 || !form.dataInicioContrato) {
      toast.error("Preencha os dados principais do contrato do professor.");
      return;
    }

    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    try {
      const payload = {
        ...form,
        nome: form.nome.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim(),
        cpf: form.cpf.trim(),
        cref: form.cref.trim(),
        modalidades: [...new Set(form.modalidades)],
        unidades: [...new Set(form.unidades.map((item) => item.trim()).filter(Boolean))],
        jornadaProfessor: form.jornadaProfessor.trim(),
        tipoContrato: form.tipoContrato.trim(),
        observacoesContrato: form.observacoesContrato.trim(),
      };

      if (professor) {
        professoresStore.update(professor.id, payload);
        toast.success("Professor atualizado.");
      } else {
        professoresStore.create(payload);
        toast.success("Professor cadastrado.");
      }

      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const inputClassName = "j12-field w-full px-3 py-2 text-sm";
  const labelClassName =
    "mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? "Editar professor" : "Novo professor"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Cadastre dados operacionais, unidades, modalidades e contrato do professor sem perder
            o padrÃ£o premium do mÃ³dulo J12.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="j12-surface p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Dados do professor
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClassName}>Nome completo</label>
                <input
                  className={inputClassName}
                  value={form.nome}
                  onChange={(e) => updateField("nome", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClassName}>E-mail</label>
                <input
                  type="email"
                  className={inputClassName}
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClassName}>Telefone</label>
                <input
                  className={inputClassName}
                  value={form.telefone}
                  onChange={(e) => updateField("telefone", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClassName}>CPF</label>
                <input
                  className={inputClassName}
                  value={form.cpf}
                  onChange={(e) => updateField("cpf", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClassName}>CREF</label>
                <input
                  className={inputClassName}
                  value={form.cref}
                  onChange={(e) => updateField("cref", e.target.value)}
                  placeholder="Ex: CREF 123456-G/SP"
                />
              </div>
              <div>
                <label className={labelClassName}>Status</label>
                <select
                  className={inputClassName}
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value as StatusProfessor)}
                >
                  {STATUS_PROFESSOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClassName}>Jornada / carga horaria</label>
                <input
                  className={inputClassName}
                  value={form.jornadaProfessor}
                  onChange={(e) => updateField("jornadaProfessor", e.target.value)}
                  placeholder="Ex: Seg, Qua e Sex â€¢ 14:00 Ã s 18:00"
                />
              </div>
            </div>
          </section>

          <section className="j12-surface p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Modalidades e unidades
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                <div className={labelClassName}>Modalidades</div>
                <div className="flex flex-wrap gap-2">
                  {form.modalidades.map((modalidade) => (
                    <Badge key={modalidade} className="border-primary/30 bg-primary/15 text-primary">
                      {modalidade}
                    </Badge>
                  ))}
                  {form.modalidades.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Nenhuma modalidade selecionada.</span>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {availableModalidades.map((modalidade) => {
                    const checked = form.modalidades.includes(modalidade);
                    return (
                      <button
                        key={modalidade}
                        type="button"
                        onClick={() => toggleModalidade(modalidade)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          checked
                            ? "border-primary/40 bg-primary/15 text-foreground"
                            : "border-border bg-card/70 text-foreground/80 hover:border-primary/20 hover:bg-card"
                        }`}
                      >
                        <div className="font-medium">{modalidade}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Clique para {checked ? "remover" : "adicionar"} esta modalidade.
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className={labelClassName}>Unidades</div>
                <div className="flex flex-wrap gap-2">
                  {form.unidades.map((unidade) => (
                    <Badge key={unidade} className="border-primary/30 bg-primary/15 text-primary">
                      {unidade}
                    </Badge>
                  ))}
                  {form.unidades.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Nenhuma unidade selecionada.</span>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {availableUnits.map((unidade) => {
                    const checked = form.unidades.includes(unidade);
                    return (
                      <button
                        key={unidade}
                        type="button"
                        onClick={() => toggleUnidade(unidade)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          checked
                            ? "border-primary/40 bg-primary/15 text-foreground"
                            : "border-border bg-card/70 text-foreground/80 hover:border-primary/20 hover:bg-card"
                        }`}
                      >
                        <div className="font-medium">{unidade}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Clique para {checked ? "remover" : "adicionar"} esta unidade.
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="j12-surface p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Turmas vinculadas
            </div>
            <div className="mb-3 text-sm text-muted-foreground">
              Apenas turmas compatÃ­veis com as unidades e modalidades selecionadas podem ser
              vinculadas ao professor.
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {compatibleTurmas.map((turma) => {
                const checked = form.turmas.includes(turma.nome);
                return (
                  <button
                    key={turma.id}
                    type="button"
                    onClick={() => toggleTurma(turma.nome)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      checked
                        ? "border-primary/40 bg-primary/15 text-foreground"
                        : "border-border bg-card/70 text-foreground/80 hover:border-primary/20 hover:bg-card"
                    }`}
                  >
                    <div className="font-medium">{turma.nome}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {turma.modalidade} â€¢ {turma.unidade} â€¢ {turma.horarioInicio} -{" "}
                      {turma.horarioFim}
                    </div>
                  </button>
                );
              })}
            </div>
            {compatibleTurmas.length === 0 ? (
              <div className="mt-4 j12-empty-state p-4 text-sm text-muted-foreground">
                Nenhuma turma compatÃ­vel com a combinaÃ§Ã£o atual de unidades e modalidades.
              </div>
            ) : null}
          </section>

          <section className="j12-surface p-5">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
              Contrato do professor
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClassName}>Tipo de contrato</label>
                <select
                  className={inputClassName}
                  value={form.tipoContrato}
                  onChange={(e) => updateField("tipoContrato", e.target.value)}
                >
                  {TIPO_CONTRATO_OPTIONS.map((tipoContrato) => (
                    <option key={tipoContrato} value={tipoContrato}>
                      {tipoContrato}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClassName}>Forma de pagamento</label>
                <select
                  className={inputClassName}
                  value={form.formaPagamentoProfessor}
                  onChange={(e) =>
                    updateField(
                      "formaPagamentoProfessor",
                      e.target.value as FormaPagamentoProfessor,
                    )
                  }
                >
                  {FORMA_PAGAMENTO_PROFESSOR_OPTIONS.map((forma) => (
                    <option key={forma} value={forma}>
                      {forma}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClassName}>Valor combinado</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.valorContrato}
                  onChange={(e) => updateField("valorContrato", Number(e.target.value || "0"))}
                />
              </div>
              <div>
                <label className={labelClassName}>Data de inicio</label>
                <Input
                  type="date"
                  value={form.dataInicioContrato}
                  onChange={(e) => updateField("dataInicioContrato", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClassName}>Observacoes contratuais</label>
                <Textarea
                  value={form.observacoesContrato}
                  onChange={(e) => updateField("observacoesContrato", e.target.value)}
                  placeholder="Detalhes adicionais, regras combinadas, bonus e observacoes internas."
                  className="j12-field min-h-[120px] text-sm"
                />
              </div>
            </div>
          </section>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "Salvando..." : isEdit ? "Salvar professor" : "Cadastrar professor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
